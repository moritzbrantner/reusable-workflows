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

type ValidationState = {
  docs: Record<string, string>;
  optionalDocs?: Record<string, string | undefined>;
  repoWorkflowPaths: string[];
  workflowStandard?: string;
  workflows: Record<string, WorkflowContract>;
  workflowSources: Record<string, string | undefined>;
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractPath = path.join(root, "contracts", "workflows.json");
const optionalUpstreamDoc = path.resolve(root, "..", "monorepo", "REUSABLE_WORKFLOWS.md");

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function readWorkflow(source: string): WorkflowFile {
  const parsed = parse(source) as unknown;

  return isRecord(parsed) ? (parsed as WorkflowFile) : {};
}

function workflowCallFor(workflow: WorkflowFile): WorkflowCall {
  return workflow.on?.workflow_call ?? workflow.true?.workflow_call ?? {};
}

export function workflowCallDefined(source: string): boolean {
  const workflow = readWorkflow(source);

  return Boolean(workflow.on?.workflow_call ?? workflow.true?.workflow_call);
}

function compactContractMap(map: Record<string, unknown> | undefined): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(map ?? {}).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

export function validateWorkflowContractsState(state: ValidationState): string[] {
  const errors: string[] = [];

  if (state.workflowStandard !== "workflow-standard-v1.3") {
    errors.push("contracts/workflows.json must declare workflow_standard workflow-standard-v1.3");
  }

  for (const [relativePath, expected] of Object.entries(state.workflows)) {
    const source = state.workflowSources[relativePath];

    if (!source) {
      errors.push(`Missing workflow file: ${relativePath}`);
      continue;
    }

    const workflow = readWorkflow(source);
    const workflowCall = workflowCallFor(workflow);

    const comparisons = [
      ["Input", compactContractMap(workflowCall.inputs), compactContractMap(expected.inputs)],
      ["Secret", compactContractMap(workflowCall.secrets), compactContractMap(expected.secrets)],
      ["Output", compactContractMap(workflowCall.outputs), compactContractMap(expected.outputs)],
    ] as const;

    for (const [label, actual, wanted] of comparisons) {
      if (stableJson(actual) !== stableJson(wanted)) {
        errors.push(`${label} contract drift in ${relativePath}`);
      }
    }

    for (const error of permissionContractErrors(relativePath, workflow, expected.permissions)) {
      errors.push(error);
    }
  }

  const contractWorkflowPaths = Object.keys(state.workflows).sort();
  const missingContracts = state.repoWorkflowPaths.filter(
    (workflowPath) => !contractWorkflowPaths.includes(workflowPath),
  );
  const extraContracts = contractWorkflowPaths.filter(
    (workflowPath) => !state.repoWorkflowPaths.includes(workflowPath),
  );

  if (missingContracts.length > 0) {
    errors.push(`Missing contract entries: ${missingContracts.join(", ")}`);
  }

  if (extraContracts.length > 0) {
    errors.push(`Contract entries for missing workflows: ${extraContracts.join(", ")}`);
  }

  const requiredDocTokens = [
    "workflow-standard-v1.3",
    ...contractWorkflowPaths.map((workflowPath) => path.basename(workflowPath)),
  ];

  for (const [docPath, content] of Object.entries(state.docs)) {
    for (const token of requiredDocTokens) {
      if (!content.includes(token)) {
        errors.push(`${docPath} does not document ${token}`);
      }
    }
  }

  for (const [docPath, content] of Object.entries(state.optionalDocs ?? {})) {
    if (content === undefined) {
      continue;
    }

    for (const token of requiredDocTokens) {
      if (!content.includes(token)) {
        errors.push(`${docPath} does not document ${token}`);
      }
    }
  }

  return errors;
}

function permissionContractErrors(
  relativePath: string,
  workflow: WorkflowFile,
  expectedPermissions: Record<string, unknown> | undefined,
) {
  const errors: string[] = [];
  const wanted = compactContractMap(expectedPermissions);
  const jobs = Object.entries(workflow.jobs ?? {});

  if (jobs.length === 0) {
    if (stableJson(wanted) !== stableJson({})) {
      errors.push(`Permission contract drift in ${relativePath}: no jobs declare permissions`);
    }

    return errors;
  }

  for (const [jobId, job] of jobs) {
    const actual = compactContractMap(job.permissions);

    if (stableJson(actual) !== stableJson(wanted)) {
      errors.push(`Permission contract drift in ${relativePath} job ${jobId}`);
    }
  }

  return errors;
}

function readValidationState(): ValidationState {
  const contract = readJson<ContractFile>(contractPath);
  const workflowsDir = path.join(root, ".github", "workflows");
  const workflowSources = Object.fromEntries(
    readdirSync(workflowsDir)
      .filter((fileName) => fileName.endsWith(".yml"))
      .map((fileName) => {
        const relativePath = path.join(".github", "workflows", fileName);

        return [relativePath, readFileSync(path.join(root, relativePath), "utf8")];
      }),
  );
  const repoWorkflowPaths = Object.entries(workflowSources)
    .filter(([, source]) => workflowCallDefined(source))
    .map(([relativePath]) => relativePath)
    .sort();
  const docs = Object.fromEntries(
    ["README.md", "SCAFFOLD_ALIGNMENT.md"].map((docPath) => [
      docPath,
      readFileSync(path.join(root, docPath), "utf8"),
    ]),
  );
  const optionalDocs = {
    [optionalUpstreamDoc]: existsSync(optionalUpstreamDoc)
      ? readFileSync(optionalUpstreamDoc, "utf8")
      : undefined,
  };

  return {
    docs,
    optionalDocs,
    repoWorkflowPaths,
    workflowStandard: contract.workflow_standard,
    workflows: contract.workflows,
    workflowSources,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function main() {
  const state = readValidationState();
  const errors = validateWorkflowContractsState(state);

  for (const [docPath, content] of Object.entries(state.optionalDocs ?? {})) {
    if (content === undefined) {
      console.warn(`Skipping optional upstream doc check; ${docPath} is not present.`);
    }
  }

  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exit(1);
  }

  console.log("Workflow contracts are in sync.");
}

if (import.meta.main) {
  main();
}
