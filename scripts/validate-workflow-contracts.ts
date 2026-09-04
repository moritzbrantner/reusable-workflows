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
  executionReceiptSchema?: unknown;
  artifactProvenanceSchema?: unknown;
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactPromotionWorkflowPath = ".github/workflows/artifact-promotion.yml";
const codingToolingWorkflowPath = ".github/workflows/coding-tooling-validation.yml";
const commandValidationWorkflowPath = ".github/workflows/command-validation.yml";
const deployQualifiedPagesWorkflowPath = ".github/workflows/deploy-qualified-pages.yml";
const releaseQualificationWorkflowPath = ".github/workflows/release-qualification.yml";
const immutableCodingToolingUse = /uses:\s*moritzbrantner\/coding-tooling@[0-9a-f]{40}(?:\s|$)/m;
const immutableAttestUse = /uses:\s*actions\/attest@[0-9a-f]{40}(?:\s|$)/m;
const immutableDownloadArtifactUse = /uses:\s*actions\/download-artifact@[0-9a-f]{40}(?:\s|$)/m;
const executionReceiptKind = "reusable-workflows/execution-receipt";
const executionReceiptOutputs = ["receipt_artifact_name", "receipt_path"];

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

function validateExecutionReceiptSchema(schema: unknown, errors: string[]) {
  if (!isRecord(schema)) {
    errors.push("contracts/execution-receipt-v1.schema.json must contain a JSON object");
    return;
  }

  const properties = isRecord(schema.properties) ? schema.properties : {};
  const kind = isRecord(properties.kind) ? properties.kind : {};
  const schemaVersion = isRecord(properties.schemaVersion) ? properties.schemaVersion : {};

  if (schemaVersion.const !== 1 || kind.const !== executionReceiptKind) {
    errors.push("execution receipt v1 schema must lock schema version and kind");
  }

  const required = Array.isArray(schema.required) ? schema.required : [];
  for (const field of ["capability", "source", "result", "evidence", "run"]) {
    if (!required.includes(field)) {
      errors.push(`execution receipt v1 schema must require ${field}`);
    }
  }

  if (!("attestations" in properties)) {
    errors.push("execution receipt v1 schema must define optional attestation transport metadata");
  }
  if (!("upstream" in properties)) {
    errors.push("execution receipt v1 schema must define optional upstream execution references");
  }
}

function validateArtifactProvenanceSchema(schema: unknown, errors: string[]) {
  if (!isRecord(schema)) {
    errors.push("contracts/artifact-provenance-v1.schema.json must contain a JSON object");
    return;
  }

  const properties = isRecord(schema.properties) ? schema.properties : {};
  const schemaVersion = isRecord(properties.schemaVersion) ? properties.schemaVersion : {};
  if (schemaVersion.const !== 1) {
    errors.push("artifact provenance v1 schema must lock schema version 1");
  }

  const required = Array.isArray(schema.required) ? schema.required : [];
  for (const field of ["source", "artifact", "qualification"]) {
    if (!required.includes(field)) {
      errors.push(`artifact provenance v1 schema must require ${field}`);
    }
  }
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

  if (state.executionReceiptSchema !== undefined) {
    validateExecutionReceiptSchema(state.executionReceiptSchema, errors);
  }
  if (state.artifactProvenanceSchema !== undefined) {
    validateArtifactProvenanceSchema(state.artifactProvenanceSchema, errors);
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

  for (const workflowPath of [
    artifactPromotionWorkflowPath,
    codingToolingWorkflowPath,
    commandValidationWorkflowPath,
    releaseQualificationWorkflowPath,
  ]) {
    const source = state.workflowSources[workflowPath];
    if (!source) {
      continue;
    }

    const outputs = manifest.workflows[workflowPath]?.outputs ?? {};
    for (const output of executionReceiptOutputs) {
      if (!(output in outputs)) {
        errors.push(`${path.basename(workflowPath)} must expose receipt output ${output}`);
      }
    }

    if (!source.includes(executionReceiptKind)) {
      errors.push(`${path.basename(workflowPath)} must emit the shared execution receipt kind`);
    }
    if (!source.includes("execution receipt")) {
      errors.push(`${path.basename(workflowPath)} must validate its execution receipt`);
    }
  }

  for (const workflowPath of [commandValidationWorkflowPath, releaseQualificationWorkflowPath]) {
    const source = state.workflowSources[workflowPath];
    if (!source) {
      continue;
    }
    if (
      !source.includes(".repository-environment.toml") ||
      !source.includes("bash scripts/codex-environment.sh setup") ||
      !source.includes("Verify environment-v1 preserves tracked state")
    ) {
      errors.push(
        `${path.basename(workflowPath)} must use the standard environment-v1 setup seam when the repository declares environment-v1`,
      );
    }
  }

  const releaseSource = state.workflowSources[releaseQualificationWorkflowPath];
  if (releaseSource) {
    if (!immutableAttestUse.test(releaseSource)) {
      errors.push("release-qualification.yml must pin actions/attest to an exact commit SHA");
    }
    const releaseOutputs = manifest.workflows[releaseQualificationWorkflowPath]?.outputs ?? {};
    for (const output of ["attestation_id", "attestation_url", "provenance_predicate_path"]) {
      if (!(output in releaseOutputs)) {
        errors.push(`release-qualification.yml must expose provenance output ${output}`);
      }
    }
  }

  const promotionSource = state.workflowSources[artifactPromotionWorkflowPath];
  if (promotionSource) {
    if (!immutableDownloadArtifactUse.test(promotionSource)) {
      errors.push(
        "artifact-promotion.yml must pin actions/download-artifact to an exact commit SHA",
      );
    }
    if (
      !promotionSource.includes("skip-decompress: true") ||
      !promotionSource.includes("gh attestation verify") ||
      !promotionSource.includes("--signer-workflow") ||
      !promotionSource.includes("release-qualification.yml")
    ) {
      errors.push(
        "artifact-promotion.yml must verify the exact qualified archive and its release-qualification signer before promotion",
      );
    }

    const promotionInputs = Object.keys(
      manifest.workflows[artifactPromotionWorkflowPath]?.inputs ?? {},
    ).sort();
    const expectedPromotionInputs = [
      "artifact_retention_days",
      "qualification_receipt_artifact_name",
      "qualification_run_id",
      "timeout_minutes",
    ];
    if (JSON.stringify(promotionInputs) !== JSON.stringify(expectedPromotionInputs)) {
      errors.push(
        "artifact-promotion.yml must remain a reference-only promotion seam with no build or publication command inputs",
      );
    }

    const promotionOutputs = manifest.workflows[artifactPromotionWorkflowPath]?.outputs ?? {};
    for (const output of [
      "qualification_run_id",
      "source_sha",
      "artifact_name",
      "artifact_digest",
    ]) {
      if (!(output in promotionOutputs)) {
        errors.push(`artifact-promotion.yml must expose immutable promotion output ${output}`);
      }
    }
  }

  const deployQualifiedPagesSource = state.workflowSources[deployQualifiedPagesWorkflowPath];
  if (deployQualifiedPagesSource) {
    if (!immutableDownloadArtifactUse.test(deployQualifiedPagesSource)) {
      errors.push(
        "deploy-qualified-pages.yml must pin actions/download-artifact to an exact commit SHA",
      );
    }
    if (
      deployQualifiedPagesSource.includes("actions/checkout@") ||
      deployQualifiedPagesSource.includes("setup-node@") ||
      deployQualifiedPagesSource.includes("setup-bun@") ||
      deployQualifiedPagesSource.includes("build_command") ||
      deployQualifiedPagesSource.includes("install_command")
    ) {
      errors.push(
        "deploy-qualified-pages.yml must deploy an existing qualified artifact without checkout, runtime setup, install, or build inputs",
      );
    }
    if (
      !deployQualifiedPagesSource.includes("skip-decompress: true") ||
      !deployQualifiedPagesSource.includes("gh attestation verify") ||
      !deployQualifiedPagesSource.includes("--signer-workflow") ||
      !deployQualifiedPagesSource.includes("actions/upload-pages-artifact@") ||
      !deployQualifiedPagesSource.includes("actions/deploy-pages@")
    ) {
      errors.push(
        "deploy-qualified-pages.yml must reverify the original qualified artifact before Pages upload and deployment",
      );
    }

    const deployInputs = Object.keys(
      manifest.workflows[deployQualifiedPagesWorkflowPath]?.inputs ?? {},
    ).sort();
    const expectedDeployInputs = [
      "cancel_in_progress",
      "concurrency_group",
      "promotion_receipt_artifact_name",
      "promotion_run_id",
      "timeout_minutes",
    ];
    if (JSON.stringify(deployInputs) !== JSON.stringify(expectedDeployInputs)) {
      errors.push(
        "deploy-qualified-pages.yml must stay reference-only: promotion coordinates plus deployment mechanics only",
      );
    }

    const deployOutputs = manifest.workflows[deployQualifiedPagesWorkflowPath]?.outputs ?? {};
    for (const output of ["page_url", "source_sha", "artifact_name", "artifact_digest"]) {
      if (!(output in deployOutputs)) {
        errors.push(`deploy-qualified-pages.yml must expose qualified deployment output ${output}`);
      }
    }
  }

  const commandInputs = Object.keys(
    manifest.workflows[commandValidationWorkflowPath]?.inputs ?? {},
  ).sort();
  if (state.workflowSources[commandValidationWorkflowPath]) {
    const expectedCommandInputs = [
      "artifact_retention_days",
      "command",
      "setup_command",
      "timeout_minutes",
      "working_directory",
    ];
    if (JSON.stringify(commandInputs) !== JSON.stringify(expectedCommandInputs)) {
      errors.push(
        "command-validation.yml must stay runtime-neutral: setup command, validation command, timeout, retention, and working directory only",
      );
    }
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
  const executionReceiptSchema = JSON.parse(
    readFileSync(path.join(root, "contracts", "execution-receipt-v1.schema.json"), "utf8"),
  ) as unknown;
  const artifactProvenanceSchema = JSON.parse(
    readFileSync(path.join(root, "contracts", "artifact-provenance-v1.schema.json"), "utf8"),
  ) as unknown;
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
    executionReceiptSchema,
    artifactProvenanceSchema,
  };
}

export function main() {
  const errors = validateWorkflowContractsState(readValidationState());

  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exit(1);
  }

  console.log(
    "Workflow capabilities, execution receipt v1, artifact provenance v1, immutable promotion, and qualified Pages delivery are valid; v1.3 compatibility snapshot remains frozen.",
  );
}

if (import.meta.main) {
  main();
}
