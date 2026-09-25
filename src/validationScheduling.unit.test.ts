import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

const validatePath = new URL("../.github/workflows/validate.yml", import.meta.url);
const commandPath = new URL("../.github/workflows/command-validation.yml", import.meta.url);
const codingToolingPath = new URL("../.github/workflows/coding-tooling-validation.yml", import.meta.url);
const smokePath = new URL("../.github/workflows/smoke-reusable-workflows.yml", import.meta.url);

describe("simple validation scheduling", () => {
  test("keeps the ordinary pull-request path small and explicit", () => {
    const source = readFileSync(validatePath, "utf8");
    expect(source).toContain("coding-tooling-fast:");
    expect(source).toContain("actionlint:");
    expect(source).not.toContain("preserve_success_evidence");
    expect(source).not.toContain("impact_unit:");
    expect(source).not.toContain("validation-impact.yml");
    expect(source).not.toContain("validation-evidence.yml");
    expect(source).toContain("contains(github.event.pull_request.labels.*.name, 'ci:e2e')");
    expect(source).toContain("contains(github.event.pull_request.labels.*.name, 'ci:perf')");
  });

  test("keeps generic command validation as checkout, optional setup, and the real command", () => {
    const source = readFileSync(commandPath, "utf8");
    expect(source).toContain("Check out consumer repository");
    expect(source).toContain("if: ${{ inputs.setup_command != '' }}");
    expect(source).toContain("run: ${{ inputs.setup_command }}");
    expect(source).toContain("run: ${{ inputs.command }}");
    expect(source).not.toContain("continue-on-error");
    expect(source).not.toContain("execution-receipt");
    expect(source).not.toContain(".repository-environment.toml");
    expect(source).not.toContain("upload-artifact");
  });

  test("never skips coding-tooling based on derived validation evidence", () => {
    const source = readFileSync(codingToolingPath, "utf8");
    expect(source).toContain("Run coding-tooling");
    expect(source).toContain("uses: moritzbrantner/coding-tooling@45edf80384e5ea98ca8784f81f0210f3bf744858");
    expect(source).not.toContain("impact_base_sha");
    expect(source).not.toContain("impact_head_sha");
    expect(source).not.toContain("impact_unit");
    expect(source).not.toContain("preserve_success_evidence");
    expect(source).not.toContain("execution-receipt");
    expect(source).toContain("Upload failure diagnostics");
  });

  test("does not smoke-test retired validation reuse capabilities", () => {
    const source = readFileSync(smokePath, "utf8");
    expect(source).not.toContain("validation-impact.yml");
    expect(source).not.toContain("validation-evidence.yml");
    expect(source).not.toContain("examples/validation-impact.json");
  });
});
