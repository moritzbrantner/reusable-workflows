import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { describe, expect, test } from "vitest";
import { parse } from "yaml";

type WorkflowStep = {
  name?: string;
  run?: string;
  uses?: string;
  if?: string;
};

type RuntimeEvidenceWorkflow = {
  on: { workflow_call: { inputs: Record<string, { required?: boolean; default?: unknown }> } };
  jobs: { "runtime-evidence": { steps: WorkflowStep[] } };
};

const source = readFileSync(
  new URL("../.github/workflows/runtime-evidence.yml", import.meta.url),
  "utf8",
);
const workflow = parse(source) as RuntimeEvidenceWorkflow;
const steps = workflow.jobs["runtime-evidence"].steps;

describe("callable runtime evidence transport", () => {
  test("requires exact profiler pin and caller-owned comparable workloads", () => {
    const inputs = workflow.on.workflow_call.inputs;
    for (const name of ["workloads", "workload_files", "profiler_revision"]) {
      expect(inputs[name]?.required).toBe(true);
    }
    expect(inputs.prime_command?.required).not.toBe(true);
    expect(inputs.moonlight_revision?.required).not.toBe(true);
    expect(inputs.browser).toMatchObject({ required: false, default: false });
    for (const name of [
      "browser_bun_version",
      "browser_site_directory",
      "browser_server_log_id",
      "browser_preflight_command",
      "browser_build_command",
      "browser_server_acceptance_command",
      "browser_artifact_paths",
    ]) {
      expect(inputs[name]?.required).not.toBe(true);
    }
    expect(source).toContain('[[ "$BASE_SHA" =~ ^[0-9a-f]{40}$');
    expect(source).toContain('[[ "$RUNTIME_PROFILER_REV" =~ ^[0-9a-f]{40}$');
  });

  test("captures both exact checkouts, scores, and retains diagnostics on failure", () => {
    const checkouts = steps.filter((step) => step.uses?.startsWith("actions/checkout@"));
    expect(checkouts).toHaveLength(3);
    expect(source).toContain("github.event.pull_request.head.sha");
    expect(source).toContain("github.event.pull_request.base.sha");
    expect(source).toContain('git -C reference add -- "$relative_path"');
    expect(source).toContain(
      'runtime-profiler validate --bundle "$RUNNER_TEMP/reference-$workload"',
    );
    expect(source).toContain(
      'runtime-profiler validate --bundle "$RUNNER_TEMP/candidate-$workload"',
    );
    expect(source).toContain("runtime-profiler score");
    expect(steps.find((step) => step.name === "Capture and compare runtime evidence")?.if).toBe(
      "${{ !inputs.browser }}",
    );
    expect(steps.find((step) => step.name === "Upload evidence for exact candidate")?.if).toBe(
      "${{ always() && !inputs.browser }}",
    );
  });

  test("browser mode provisions Chromium, serves both exact sites, and fails non-comparable captures", () => {
    expect(source).toContain("npx --no-install playwright install --with-deps chromium");
    expect(source).toContain("inputs.browser_build_command");
    expect(source).toContain("inputs.browser_preflight_command");
    expect(source).toContain("inputs.browser_server_acceptance_command");
    expect(source).toContain('capture_side reference "$workload" "$scenario"');
    expect(source).toContain('capture_side candidate "$workload" "$scenario"');
    expect(source).toContain('runtime-profiler validate --bundle "$RUNNER_TEMP/$side-$workload"');
    expect(source).toContain("runtime-profiler compare-browser");
    expect(source).toContain("jq -e '.status == \"comparable\"'");
    expect(source).toContain("trap - EXIT");
    expect(steps.find((step) => step.name === "Upload browser evidence for exact candidate")?.if).toBe(
      "${{ always() && inputs.browser }}",
    );
  });

  test("keeps optional Moonlight and artifact identity owned by consumers", () => {
    expect(steps.find((step) => step.name === "Check out pinned Moonlight")?.if).toContain(
      "moonlight_revision != ''",
    );
    expect(source).toContain("inputs.artifact_name");
    expect(source).toContain("inputs.job_name");
    expect(source).toContain("inputs.artifact_retention_days");
  });

  test("all hosted shell steps parse with bash", () => {
    for (const step of steps) {
      if (!step.run) continue;
      const bash = spawnSync("bash", ["-n"], {
        input: step.run.replaceAll(/\$\{\{[^}]+\}\}/g, "expression"),
        encoding: "utf8",
      });
      expect(bash.status, `${step.name}: ${bash.stderr}`).toBe(0);
    }
  });
});
