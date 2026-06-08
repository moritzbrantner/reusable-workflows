/* eslint-disable no-console */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

type WorkflowCall = {
  inputs?: Record<string, unknown>;
  secrets?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
};

type WorkflowContract = {
  inputs?: Record<string, unknown>;
  secrets?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  permissions?: Record<string, unknown>;
};

type ContractFile = {
  workflow_standard?: string;
  workflows: Record<string, WorkflowContract>;
};

type WorkflowFile = {
  on?: {
    workflow_call?: WorkflowCall;
  };
  true?: {
    workflow_call?: WorkflowCall;
  };
  jobs?: Record<string, { permissions?: Record<string, unknown> }>;
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractPath = path.join(root, "contracts", "workflows.json");
const optionalUpstreamDoc = path.resolve(root, "..", "monorepo", "REUSABLE_WORKFLOWS.md");

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function readWorkflow(filePath: string): WorkflowFile {
  return parse(readFileSync(filePath, "utf8")) as WorkflowFile;
}

function workflowCallFor(filePath: string): WorkflowCall {
  const workflow = readWorkflow(filePath);
  return workflow.on?.workflow_call ?? workflow.true?.workflow_call ?? {};
}

function workflowCallDefined(filePath: string): boolean {
  const workflow = readWorkflow(filePath);
  return Boolean(workflow.on?.workflow_call ?? workflow.true?.workflow_call);
}

function firstJobFor(filePath: string): { permissions?: Record<string, unknown> } {
  const workflow = readWorkflow(filePath);
  const firstJob = Object.values(workflow.jobs ?? {})[0];
  return firstJob ?? {};
}

function compactContractMap(map: Record<string, unknown> | undefined): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(map ?? {}).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

const contract = readJson<ContractFile>(contractPath);
const errors: string[] = [];

if (contract.workflow_standard !== "workflow-standard-v1.2") {
  errors.push("contracts/workflows.json must declare workflow_standard workflow-standard-v1.2");
}

const workflowContracts = contract.workflows;

for (const [relativePath, expected] of Object.entries(workflowContracts)) {
  const filePath = path.join(root, relativePath);
  if (!existsSync(filePath)) {
    errors.push(`Missing workflow file: ${relativePath}`);
    continue;
  }

  const workflowCall = workflowCallFor(filePath);
  const firstJob = firstJobFor(filePath);

  const comparisons = [
    ["Input", compactContractMap(workflowCall.inputs), compactContractMap(expected.inputs)],
    ["Secret", compactContractMap(workflowCall.secrets), compactContractMap(expected.secrets)],
    ["Output", compactContractMap(workflowCall.outputs), compactContractMap(expected.outputs)],
    [
      "Permission",
      compactContractMap(firstJob.permissions),
      compactContractMap(expected.permissions),
    ],
  ] as const;

  for (const [label, actual, wanted] of comparisons) {
    if (stableJson(actual) !== stableJson(wanted)) {
      errors.push(`${label} contract drift in ${relativePath}`);
    }
  }
}

const repoWorkflows = readdirSync(path.join(root, ".github", "workflows"))
  .filter((fileName) => fileName.endsWith(".yml"))
  .map((fileName) => path.join(".github", "workflows", fileName))
  .filter((relativePath) => workflowCallDefined(path.join(root, relativePath)))
  .sort();

const contractWorkflowPaths = Object.keys(workflowContracts).sort();
const missingContracts = repoWorkflows.filter(
  (workflowPath) => !contractWorkflowPaths.includes(workflowPath),
);
const extraContracts = contractWorkflowPaths.filter(
  (workflowPath) => !repoWorkflows.includes(workflowPath),
);

if (missingContracts.length > 0) {
  errors.push(`Missing contract entries: ${missingContracts.join(", ")}`);
}

if (extraContracts.length > 0) {
  errors.push(`Contract entries for missing workflows: ${extraContracts.join(", ")}`);
}

const requiredDocTokens = [
  "workflow-standard-v1.2",
  ...contractWorkflowPaths.map((workflowPath) => path.basename(workflowPath)),
];

for (const docPath of ["README.md", "SCAFFOLD_ALIGNMENT.md"]) {
  const content = readFileSync(path.join(root, docPath), "utf8");
  for (const token of requiredDocTokens) {
    if (!content.includes(token)) {
      errors.push(`${docPath} does not document ${token}`);
    }
  }
}

if (existsSync(optionalUpstreamDoc)) {
  const upstreamContent = readFileSync(optionalUpstreamDoc, "utf8");
  for (const token of requiredDocTokens) {
    if (!upstreamContent.includes(token)) {
      errors.push(`${optionalUpstreamDoc} does not document ${token}`);
    }
  }
} else {
  console.warn(`Skipping optional upstream doc check; ${optionalUpstreamDoc} is not present.`);
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Workflow contracts are in sync.");
