/* eslint-disable no-console */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

import {
  generateCapabilityManifest,
  readRepositoryWorkflowSources,
} from "./generate-workflow-manifest";

type CompatibilitySnapshot = {
  workflow_standard?: string;
  workflows?: Record<string, { inputs?: Record<string, unknown> }>;
};

type WorkflowFile = {
  on?: unknown;
  true?: unknown;
  jobs?: Record<string, { permissions?: Record<string, unknown> }>;
};

export type ValidationState = {
  docs: Record<string, string>;
  workflowSources: Record<string, string>;
  compatibilitySnapshot: CompatibilitySnapshot;
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const codingToolingWorkflowPath = ".github/workflows/coding-tooling-validation.yml";
const immutableCodingToolingUse = /uses:\s*moritzbrantner\/coding-tooling@[0-9a-f]{40}(?:\s|$)/m;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readWorkflow(source: string): WorkflowFile {
  const parsed = parse(source) as unknown;
  return isRecord(parsed) ? (parsed as WorkflowFile) : {};
}

function isCallable(workflow: WorkflowFile): boolean {
  return [workflow.on, workflow.true].some(
    (triggers) => isRecord(triggers) && "workflow_call" in triggers,
  );
}

export function validateWorkflowContractsState(state: ValidationState): string[] {
  const errors: string[] = [];
  const manifest = generateCapabilityManifest(state.workflowSources);
  const workflowPaths = Object.keys(manifest.workflows).sort();

  if (state.compatibilitySnapshot.workflow_standard !== "workflow-standard-v1.3") {
    errors.push("contracts/workflows.json must remain the frozen workflow-standard-v1.3 snapshot");
  }

  const compatibilityFast =
    state.compatibilitySnapshot.workflows?.[".github/workflows/fast-validation.yml"]?.inputs ?? {};
  if (!("format_command" in compatibilityFast) || !("unit_test_command" in compatibilityFast)) {
    errors.push("workflow-standard-v1.3 fast-validation compatibility inputs must remain frozen");
  }

  for (const [relativePath, source] of Object.entries(state.workflowSources)) {
    const workflow = readWorkflow(source);
    if (!isCallable(workflow)) {
      continue;
    }

    const jobs = Object.entries(workflow.jobs ?? {});
    if (jobs.length === 0) {
      errors.push(`${relativePath} has workflow_call but no jobs`);
      continue;
    }

    for (const [jobId, job] of jobs) {
      if (job.permissions === undefined) {
        errors.push(`${relativePath} job ${jobId} must declare explicit permissions`);
      }
    }
  }

  const codingToolingSource = state.workflowSources[codingToolingWorkflowPath];
  if (codingToolingSource && !immutableCodingToolingUse.test(codingToolingSource)) {
    errors.push(
      "coding-tooling-validation.yml must pin moritzbrantner/coding-tooling to an exact commit SHA",
    );
  }
  const codingToolingInputs = manifest.workflows[codingToolingWorkflowPath]?.inputs ?? {};
  if (codingToolingSource && !("operation" in codingToolingInputs)) {
    errors.push("coding-tooling-validation.yml must expose the coding-tooling operation input");
  }

  const fastInputs = Object.keys(
    manifest.workflows[".github/workflows/fast-validation.yml"]?.inputs ?? {},
  ).sort();
  const expectedFastInputs = [
    "bun_version",
    "command",
    "install_command",
    "node_version",
    "timeout_minutes",
    "working_directory",
  ];

  if (JSON.stringify(fastInputs) !== JSON.stringify(expectedFastInputs)) {
    errors.push(
      "fast-validation.yml must keep the thin capability interface: command plus runtime/setup inputs",
    );
  }

  for (const [docPath, content] of Object.entries(state.docs)) {
    for (const workflowPath of workflowPaths) {
      const fileName = path.basename(workflowPath);
      if (!content.includes(fileName)) {
        errors.push(`${docPath} does not document ${fileName}`);
      }
    }
  }

  return errors;
}

function readValidationState(): ValidationState {
  const compatibilitySnapshot = JSON.parse(
    readFileSync(path.join(root, "contracts", "workflows.json"), "utf8"),
  ) as CompatibilitySnapshot;
  const docs = Object.fromEntries(
    ["README.md", "CONTEXT.md"].map((docPath) => [
      docPath,
      readFileSync(path.join(root, docPath), "utf8"),
    ]),
  );

  return {
    docs,
    workflowSources: readRepositoryWorkflowSources(),
    compatibilitySnapshot,
  };
}

export function main() {
  const errors = validateWorkflowContractsState(readValidationState());

  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exit(1);
  }

  console.log("Workflow capabilities are valid; v1.3 compatibility snapshot remains frozen.");
}

if (import.meta.main) {
  main();
}
