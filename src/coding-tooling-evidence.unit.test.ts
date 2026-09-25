import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

const workflowPath = new URL("../.github/workflows/coding-tooling-validation.yml", import.meta.url);

describe("coding-tooling validation boundary", () => {
  test("runs one caller-established source revision through checkout and tooling", () => {
    const source = readFileSync(workflowPath, "utf8");
    expect(source).toContain("Check out exact consumer revision");
    expect(source).toContain("inputs.source_sha != '' && inputs.source_sha");
    expect(source).toContain("github.event.pull_request.head.sha || github.sha");
    expect(source).toContain('echo "source_sha=$(git rev-parse HEAD)"');
    expect(source).toContain("source-sha: ${{ steps.metadata.outputs.source_sha }}");
  });

  test("pins coding-tooling and treats artifacts as failure diagnostics only", () => {
    const source = readFileSync(workflowPath, "utf8");
    expect(source).toContain(
      "uses: moritzbrantner/coding-tooling@45edf80384e5ea98ca8784f81f0210f3bf744858",
    );
    expect(source).toContain("evidence_path:");
    expect(source).toContain("Upload failure diagnostics");
    expect(source).toContain("steps.tooling.outcome != 'success'");
    expect(source).toContain("include-hidden-files: true");
    expect(source).not.toContain("preserve_success_evidence");
    expect(source).not.toContain("receipt_artifact_name");
  });

  test("keeps the narrow missing-foundation rollout compatibility rule", () => {
    const source = readFileSync(workflowPath, "utf8");
    expect(source).toContain("allow_missing_foundation:");
    expect(source).toContain('status in {"invalid", "unsupported"}');
    expect(source).toContain('"missing" not in statuses');
    expect(source).toContain("Propagate coding-tooling failure");
  });
});
