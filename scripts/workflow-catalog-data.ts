import { parse } from "yaml";

import type { ParsedJob } from "../src/app/types";

type WorkflowYaml = {
  jobs?: Record<string, WorkflowJobYaml>;
  name?: unknown;
  on?: unknown;
  true?: unknown;
};

type WorkflowJobYaml = {
  name?: unknown;
  needs?: unknown;
  "runs-on"?: unknown;
  steps?: unknown;
  "timeout-minutes"?: unknown;
  uses?: unknown;
};

export type ParsedWorkflowCatalogData = {
  jobs: ParsedJob[];
  triggers: string[];
  yamlName: string;
};

export function parseWorkflowForCatalog(source: string): ParsedWorkflowCatalogData {
  const workflowYaml = parseWorkflowSource(source);

  return {
    jobs: parseWorkflowJobs(workflowYaml),
    triggers: parseWorkflowTriggers(workflowYaml),
    yamlName: readYamlString(workflowYaml.name) ?? "",
  };
}

function parseWorkflowSource(source: string): WorkflowYaml {
  const parsed = parse(source) as unknown;

  if (!isYamlRecord(parsed)) {
    throw new Error("Workflow YAML must parse to an object.");
  }

  return parsed as WorkflowYaml;
}

function parseWorkflowTriggers(workflowYaml: WorkflowYaml) {
  const triggersValue = workflowYaml.on ?? workflowYaml.true;

  if (triggersValue === undefined) {
    return ["workflow_call"];
  }

  const triggerList = readYamlStringList(triggersValue);

  if (triggerList.length > 0) {
    return triggerList;
  }

  if (isYamlRecord(triggersValue)) {
    return Object.keys(triggersValue);
  }

  return ["workflow_call"];
}

function parseWorkflowJobs(workflowYaml: WorkflowYaml): ParsedJob[] {
  if (!workflowYaml.jobs || !isYamlRecord(workflowYaml.jobs)) {
    return [];
  }

  return Object.entries(workflowYaml.jobs).map(([id, job]) => {
    const workflowJob = job as WorkflowJobYaml;
    const uses = readYamlString(workflowJob.uses);
    const timeoutMinutes = readYamlNumber(workflowJob["timeout-minutes"]);
    const runsOn = readYamlStringList(workflowJob["runs-on"]).join(", ") || undefined;

    return {
      id,
      name: readYamlString(workflowJob.name) ?? titleFromSlug(id),
      uses,
      usesWorkflow: uses ? normalizeWorkflowRef(uses) : undefined,
      needs: readYamlStringList(workflowJob.needs),
      runsOn,
      timeoutMinutes,
      stepCount: Array.isArray(workflowJob.steps) ? workflowJob.steps.length : 0,
    };
  });
}

function normalizeWorkflowRef(ref: string) {
  const refWithoutVersion = ref.split("@")[0];
  const workflowIndex = refWithoutVersion.indexOf(".github/workflows/");

  return workflowIndex >= 0 ? refWithoutVersion.slice(workflowIndex) : undefined;
}

function readYamlString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function readYamlNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readYamlStringList(value: unknown) {
  if (typeof value === "string") {
    return value ? [value] : [];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isYamlRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
