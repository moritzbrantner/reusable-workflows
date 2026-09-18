import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

const workflowPath = new URL("../.github/workflows/coding-tooling-validation.yml", import.meta.url);

describe("coding-tooling repository evidence preservation", () => {
  test("stages a literal repository-relative evidence path before artifact upload", () => {
    const source = readFileSync(workflowPath, "utf8");

    expect(source).toContain("evidence_path:");
    expect(source).toContain("Stage repository evidence");
    expect(source).toContain('raw = os.environ["EVIDENCE_PATH"]');
    expect(source).toContain('stage_root = Path(os.environ["RUNNER_TEMP"]) / "repository-evidence"');
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

  test("pins the environment-v1-aware coding-tooling action", () => {
    const source = readFileSync(workflowPath, "utf8");

    expect(source).toContain(
      "uses: moritzbrantner/coding-tooling@3f7e2387dda68fd27ddd72a8b995f126678ff4ff",
    );
  });
});
