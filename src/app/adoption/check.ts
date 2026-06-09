import workflowContracts from "../../../contracts/workflows.json";
import type { AdoptionCheckResult, AdoptionDiagnostic } from "./types";

type WorkflowJob = {
  permissions?: unknown;
  secrets?: unknown;
  uses?: unknown;
  with?: unknown;
};

type WorkflowYaml = {
  jobs?: unknown;
};

type ReusableWorkflowCall = {
  ref: string;
  workflowPath: string;
};

const reusableWorkflowPattern =
  /moritzbrantner\/reusable-workflows\/(\.github\/workflows\/[^@\s'"]+)@([^/\s'"]+)/;
const workflowStandardRefPattern = /^workflow-standard-v\d+(?:\.\d+)*$/;
const allowedAlwaysArtifactWorkflows = new Set([
  ".github/workflows/e2e-validation.yml",
  ".github/workflows/storybook-validation.yml",
  ".github/workflows/performance-validation.yml",
  ".github/workflows/package-publish.yml",
]);

export function checkAdoptionYaml(
  source: string,
  file = "pasted workflow.yml",
): AdoptionCheckResult {
  return {
    diagnostics: checkWorkflowObject(parseWorkflowSource(source), source, file),
  };
}

export function checkWorkflowObject(
  workflow: WorkflowYaml,
  source = "",
  file = "workflow.yml",
): AdoptionDiagnostic[] {
  if (!isRecord(workflow.jobs)) {
    return [];
  }

  return Object.entries(workflow.jobs).flatMap(([jobId, value]) => {
    if (!isRecord(value)) {
      return [];
    }

    return checkJob(jobId, value as WorkflowJob, source, file);
  });
}

export function formatAdoptionCheckResultAsJson(result: AdoptionCheckResult) {
  return JSON.stringify(result, null, 2);
}

function checkJob(jobId: string, job: WorkflowJob, source: string, file: string) {
  const diagnostics: AdoptionDiagnostic[] = [];
  const uses = typeof job.uses === "string" ? job.uses : "";
  const call = parseReusableWorkflowCall(uses);

  if (job.secrets === "inherit") {
    diagnostics.push({
      code: "inherited-secrets",
      level: "warning",
      message: `Job ${jobId} uses secrets: inherit. Pass only the secrets required by the reusable workflow.`,
      file,
      line: lineForText(source, "secrets: inherit"),
    });
  }

  if (!call) {
    return diagnostics;
  }

  if (!workflowStandardRefPattern.test(call.ref)) {
    diagnostics.push({
      code: "moving-workflow-ref",
      level: "warning",
      message: `Job ${jobId} uses ${call.ref}. Pin reusable workflows to a workflow-standard-* release tag.`,
      file,
      line: lineForText(source, uses),
    });
  }

  if (!isRecord(job.permissions)) {
    diagnostics.push({
      code: "missing-job-permissions",
      level: "warning",
      message: `Job ${jobId} calls ${call.workflowPath} without explicit job-level permissions.`,
      file,
      line: lineForText(source, uses),
    });
  } else {
    diagnostics.push(
      ...permissionDiagnostics(jobId, call.workflowPath, job.permissions, file, source),
    );
  }

  diagnostics.push(...workingDirectoryDiagnostics(jobId, job, file, source));
  diagnostics.push(...artifactPolicyDiagnostics(jobId, call.workflowPath, job, file, source));

  return diagnostics;
}

function permissionDiagnostics(
  jobId: string,
  workflowPath: string,
  permissions: Record<string, unknown>,
  file: string,
  source: string,
) {
  const diagnostics: AdoptionDiagnostic[] = [];
  const contract =
    workflowContracts.workflows[workflowPath as keyof typeof workflowContracts.workflows];

  if (!contract) {
    return diagnostics;
  }

  for (const [permission, requiredAccess] of Object.entries(contract.permissions)) {
    const actualAccess = permissions[permission];

    if (permissionLevel(actualAccess) < permissionLevel(requiredAccess)) {
      diagnostics.push({
        code: "weak-job-permissions",
        level: "warning",
        message: `Job ${jobId} should grant ${permission}: ${requiredAccess} for ${workflowPath}.`,
        file,
        line: lineForText(source, "permissions:"),
      });
    }
  }

  return diagnostics;
}

function workingDirectoryDiagnostics(
  jobId: string,
  job: WorkflowJob,
  file: string,
  source: string,
) {
  const diagnostics: AdoptionDiagnostic[] = [];

  if (!isRecord(job.with) || typeof job.with.working_directory !== "string") {
    return diagnostics;
  }

  const workingDirectory = job.with.working_directory;

  if (workingDirectory === "." || workingDirectory === "") {
    return diagnostics;
  }

  const cachePaths = [
    job.with.bun_cache_dependency_path,
    job.with.npm_cache_dependency_path,
    job.with.cargo_cache_dependency_path,
  ].filter((value): value is string => typeof value === "string");

  if (cachePaths.length === 0 || cachePaths.some((cachePath) => cachePath.startsWith("**/"))) {
    diagnostics.push({
      code: "broad-monorepo-cache-path",
      level: "warning",
      message: `Job ${jobId} sets working_directory but leaves cache dependency paths broad. Scope cache paths to ${workingDirectory}.`,
      file,
      line: lineForText(source, "working_directory"),
    });
  }

  return diagnostics;
}

function artifactPolicyDiagnostics(
  jobId: string,
  workflowPath: string,
  job: WorkflowJob,
  file: string,
  source: string,
) {
  if (
    isRecord(job.with) &&
    job.with.upload_artifacts_on === "always" &&
    !allowedAlwaysArtifactWorkflows.has(workflowPath)
  ) {
    return [
      {
        code: "broad-artifact-upload",
        level: "warning" as const,
        message: `Job ${jobId} uploads artifacts on every run. Prefer failure unless artifacts are intentionally reviewed.`,
        file,
        line: lineForText(source, "upload_artifacts_on"),
      },
    ];
  }

  return [];
}

function parseReusableWorkflowCall(uses: string): ReusableWorkflowCall | null {
  const match = uses.match(reusableWorkflowPattern);

  if (!match) {
    return null;
  }

  return {
    workflowPath: match[1],
    ref: match[2],
  };
}

function parseWorkflowSource(source: string): WorkflowYaml {
  const jobs: Record<string, WorkflowJob> = {};
  const lines = source.split("\n");
  let currentJob: WorkflowJob | null = null;
  let currentMap: "permissions" | "with" | null = null;

  for (const line of lines) {
    const jobMatch = line.match(/^  ([A-Za-z0-9_-]+):\s*$/);

    if (jobMatch) {
      currentJob = {};
      jobs[jobMatch[1]] = currentJob;
      currentMap = null;
      continue;
    }

    if (!currentJob) {
      continue;
    }

    const propertyMatch = line.match(/^    ([A-Za-z0-9_-]+):(?:\s*(.*))?$/);

    if (propertyMatch) {
      const [, key, rawValue = ""] = propertyMatch;
      currentMap = null;

      if (key === "permissions" || key === "with") {
        currentJob[key] = {};
        currentMap = key;
        continue;
      }

      currentJob[key as keyof WorkflowJob] = parseScalar(rawValue);
      continue;
    }

    const mapEntryMatch = line.match(/^      ([A-Za-z0-9_-]+):(?:\s*(.*))?$/);

    const currentTarget = currentMap ? currentJob[currentMap] : undefined;

    if (mapEntryMatch && currentMap && isRecord(currentTarget)) {
      const [, key, rawValue = ""] = mapEntryMatch;

      currentTarget[key] = parseScalar(rawValue);
    }
  }

  return { jobs };
}

function parseScalar(value: string) {
  const trimmed = value.trim();

  if (trimmed === "true") {
    return true;
  }

  if (trimmed === "false") {
    return false;
  }

  return trimmed.replace(/^["']|["']$/g, "");
}

function permissionLevel(value: unknown) {
  switch (value) {
    case "write":
      return 2;
    case "read":
      return 1;
    default:
      return 0;
  }
}

function lineForOffset(source: string, offset?: number) {
  if (typeof offset !== "number" || offset < 0) {
    return undefined;
  }

  return source.slice(0, offset).split("\n").length;
}

function lineForText(source: string, text: string) {
  const index = source.indexOf(text);

  return index >= 0 ? lineForOffset(source, index) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
