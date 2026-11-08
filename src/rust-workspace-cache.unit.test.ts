import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";
import { parse } from "yaml";

const workflow = parse(readFileSync(".github/workflows/validate-repo.yml", "utf8"));

describe("Rust workspace cache opt-in", () => {
  test("is disabled by default and uses a separate cache key when enabled", () => {
    expect(workflow.on.workflow_call.inputs.cache_cargo_workspace_crates.default).toBe(false);

    const cache = workflow.jobs.validate.steps.find(
      (step: { name?: string }) => step.name === "Cache Cargo",
    );
    expect(cache.with["cache-workspace-crates"]).toBe(
      "${{ inputs.cache_cargo_workspace_crates }}",
    );
    expect(cache.with.key).toBe(
      "${{ inputs.cache_cargo_workspace_crates && 'workspace-crates-v1' || '' }}",
    );
  });
});
