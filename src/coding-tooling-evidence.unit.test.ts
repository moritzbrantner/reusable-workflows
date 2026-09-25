import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

const workflowPath = new URL("../.github/workflows/coding-tooling-validation.yml", import.meta.url);

describe("coding-tooling validation adapter", () => {
  test("pushes one exact source revision through checkout and tooling", () => {
    const source = readFileSync(workflowPath, "utf8");

    expect(source).toContain("Check out exact consumer revision");
    expect(source).toContain("inputs.source_sha != '' && inputs.source_sha");
    expect(source).toContain("github.event.pull_request.head.sha || github.sha");
    expect(source).toContain('source_sha="$(git rev-parse HEAD)"');
    expect(source).toContain("source-sha: ${{ steps.metadata.outputs.source_sha }}");
  });

  test("pins the coding-tooling action", () => {
    const source = readFileSync(workflowPath, "utf8");

    expect(source).toContain(
      "uses: moritzbrantner/coding-tooling@45edf80384e5ea98ca8784f81f0210f3bf744858",
    );
  });

  test("keeps failure artifacts diagnostic rather than reusable proof", () => {
    const source = readFileSync(workflowPath, "utf8");

    expect(source).toContain("Upload failure report");
    expect(source).toContain("Upload failure evidence");
    expect(source).toContain("steps.tooling.outcome != 'success'");
    expect(source).toContain(
      "Failure artifacts: diagnostic only; they are not reusable validation proof.",
    );
    expect(source).not.toContain("execution-receipt");
    expect(source).not.toContain("preserve_success_evidence");
  });

  test("always executes coding-tooling instead of impact-routing or evidence reuse", () => {
    const source = readFileSync(workflowPath, "utf8");

    expect(source).not.toContain("impact_unit:");
    expect(source).not.toContain("impact_base_sha:");
    expect(source).not.toContain("Resolve validation impact");
    expect(source).not.toContain("Resolve validation routing");
    expect(source).not.toContain("invalidated_units_json");
  });

  test("keeps missing-foundation rollout compatibility without hiding invalid state", () => {
    const source = readFileSync(workflowPath, "utf8");

    expect(source).toContain("allow_missing_foundation:");
    expect(source).toContain('status not in {"adopted", "missing"}');
    expect(source).toContain('"missing" not in statuses');
  });
});
