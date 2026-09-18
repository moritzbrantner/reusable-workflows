import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

const workflowPath = new URL("../.github/workflows/coding-tooling-validation.yml", import.meta.url);

describe("coding-tooling repository evidence preservation", () => {
  test("stages a literal repository-relative evidence path before artifact upload", () => {
    const source = readFileSync(workflowPath, "utf8");

    expect(source).toContain("evidence_path:");
    expect(source).toContain("Stage repository evidence");
    expect(source).toContain('raw = os.environ["EVIDENCE_PATH"]');
    expect(source).toContain(
      'stage_root = Path(os.environ["RUNNER_TEMP"]) / "repository-evidence"',
    );
    expect(source).toContain("target = stage_root / relative");
    expect(source).toContain("path: ${{ steps.evidence-stage.outputs.staged_path }}");
    expect(source).not.toContain("path: ${{ inputs.evidence_path }}");
    expect(source).toContain("include-hidden-files: true");
    expect(source).toContain('"role": "repository-evidence"');
    expect(source).toContain("evidence_artifact_digest");
  });

  test("fails closed when staging or preservation of requested evidence fails", () => {
    const source = readFileSync(workflowPath, "utf8");

    expect(source).toContain("steps.evidence-stage.outcome != 'success'");
    expect(source).toContain("steps.evidence-upload.outcome != 'success'");
    expect(source).toContain("if-no-files-found: error");
    expect(source).toContain("evidence_path must stay inside the repository");
    expect(source).toContain("evidence_path directory must not contain symlinks");
  });

  test("pushes one caller-established source revision through checkout and tooling", () => {
    const source = readFileSync(workflowPath, "utf8");
    const sourceExpression =
      "${{ inputs.source_sha != '' && inputs.source_sha || inputs.impact_head_sha != '' && inputs.impact_head_sha || github.event.pull_request.head.sha || github.sha }}";

    expect(source).toContain("Check out exact consumer revision");
    expect(source).toContain(`ref: ${sourceExpression}`);
    expect(source).toContain(`source-sha: ${sourceExpression}`);
    expect(source).not.toContain('source_sha="$(git rev-parse HEAD)"');
  });

  test("pins the environment-v1-aware coding-tooling action", () => {
    const source = readFileSync(workflowPath, "utf8");

    expect(source).toContain(
      "uses: moritzbrantner/coding-tooling@45edf80384e5ea98ca8784f81f0210f3bf744858",
    );
  });

  test("skips reusable validation units without spending a coding-tooling run", () => {
    const source = readFileSync(workflowPath, "utf8");

    expect(source).toContain("Resolve validation impact");
    expect(source).toContain("Resolve validation routing");
    expect(source).toContain("impact_unit:");
    expect(source).toContain("steps.routing.outputs.execute == 'true'");
    expect(source).toContain("full_validation");
    expect(source).toContain("invalidated_units_json");
  });

  test("fails open to execution when impact evidence is not for the pushed source", () => {
    const source = readFileSync(workflowPath, "utf8");

    expect(source).toContain('SOURCE_SHA: ${{ inputs.source_sha }}');
    expect(source).toContain(
      'if [[ -n "$SOURCE_SHA" && "$SOURCE_SHA" != "$IMPACT_HEAD_SHA" ]]',
    );
    expect(source).toContain("same_source=false");
  });

  test("preserves successful evidence only when requested", () => {
    const source = readFileSync(workflowPath, "utf8");

    expect(source).toContain("preserve_success_evidence:");
    expect(source).toContain("Resolve evidence preservation");
    expect(source).toContain("steps.evidence-policy.outputs.required == 'true'");
    expect(source).toContain('TOOLING_OUTCOME: ${{ steps.tooling.outcome }}');
    expect(source).toContain("PRESERVE_SUCCESS: ${{ inputs.preserve_success_evidence }}");
  });
});
