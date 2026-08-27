/* eslint-disable no-console */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

type WorkflowCall = {
  inputs?: Record<string, unknown>;
  secrets?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
};

type WorkflowJob = {
  permissions?: Record<string, unknown>;
};

type WorkflowFile = {
  on?: {
    workflow_call?: WorkflowCall;
  };
  true?: {
    workflow_call?: WorkflowCall;
  };
  jobs?: Record<string, WorkflowJob>;
};

export type GeneratedCapabilityManifest = {
  schema_version: 1;
  contract_model: "independent-capabilities";
  compatibility_release: "workflow-standard-v1.3";
  generated_from: ".github/workflows/*.yml";
  workflows: Record<
    string,
    {
      inputs: Record<string, unknown>;
      secrets: Record<string, unknown>;
      outputs: Record<string, unknown>;
      jobs: Record<string, { permissions: Record<string, unknown> }>;
    }
  >;
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readWorkflow(source: string): WorkflowFile {
  const parsed = parse(source) as unknown;
  return isRecord(parsed) ? (parsed as WorkflowFile) : {};
}

function workflowCallFor(workflow: WorkflowFile): WorkflowCall | undefined {
  return workflow.on?.workflow_call ?? workflow.true?.workflow_call;
}

function sortedRecord(value: Record<string, unknown> | undefined): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value ?? {}).sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function generateCapabilityManifest(
  workflowSources: Record<string, string>,
): GeneratedCapabilityManifest {
  const workflows = Object.fromEntries(
    Object.entries(workflowSources)
      .map(([relativePath, source]) => [relativePath, readWorkflow(source)] as const)
      .filter(([, workflow]) => workflowCallFor(workflow) !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([relativePath, workflow]) => {
        const workflowCall = workflowCallFor(workflow) ?? {};
        const jobs = Object.fromEntries(
          Object.entries(workflow.jobs ?? {})
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([jobId, job]) => [jobId, { permissions: sortedRecord(job.permissions) }]),
        );

        return [
          relativePath,
          {
            inputs: sortedRecord(workflowCall.inputs),
            secrets: sortedRecord(workflowCall.secrets),
            outputs: sortedRecord(workflowCall.outputs),
            jobs,
          },
        ];
      }),
  );

  return {
    schema_version: 1,
    contract_model: "independent-capabilities",
    compatibility_release: "workflow-standard-v1.3",
    generated_from: ".github/workflows/*.yml",
    workflows,
  };
}

export function readRepositoryWorkflowSources(): Record<string, string> {
  const workflowsDir = path.join(root, ".github", "workflows");

  return Object.fromEntries(
    readdirSync(workflowsDir)
      .filter((fileName) => fileName.endsWith(".yml"))
      .map((fileName) => {
        const relativePath = path.join(".github", "workflows", fileName);
        return [relativePath, readFileSync(path.join(root, relativePath), "utf8")];
      }),
  );
}

export function main() {
  const manifest = generateCapabilityManifest(readRepositoryWorkflowSources());
  const output = `${JSON.stringify(manifest, null, 2)}\n`;
  const outputPath = process.argv[2];

  if (outputPath) {
    writeFileSync(path.resolve(process.cwd(), outputPath), output);
    console.error(`Wrote generated capability manifest to ${outputPath}`);
    return;
  }

  process.stdout.write(output);
}

if (import.meta.main) {
  main();
}
