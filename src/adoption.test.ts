import { describe, expect, test } from "vitest";

import { checkAdoptionYaml, formatAdoptionCheckResultAsJson } from "./app/adoption/check";
import { defaultAdoptionOptions } from "./app/adoption/profiles";
import { combinedGeneratedWorkflowText, generateAdoptionWorkflows } from "./app/adoption/generate";

describe("adoption generator", () => {
  test("emits pinned workflow-standard-v1.2 refs", () => {
    const yaml = generatedText(defaultAdoptionOptions("web-app"));

    expect(yaml).toContain(
      "moritzbrantner/reusable-workflows/.github/workflows/fast-validation.yml@workflow-standard-v1.2",
    );
    expect(yaml).not.toContain("@main");
  });

  test("emits explicit permissions for selected reusable workflows", () => {
    const yaml = generatedText({
      ...defaultAdoptionOptions("pages-site"),
      includePerformance: true,
    });

    expect(yaml).toContain("permissions:\n      contents: read\n      packages: read");
    expect(yaml).toContain("permissions:\n      actions: read\n      contents: read");
    expect(yaml).toContain("pages: write");
  });

  test("never emits inherited secrets", () => {
    const yaml = generatedText(defaultAdoptionOptions("package"));

    expect(yaml).not.toContain("secrets: inherit");
    expect(yaml).toContain("publish_enabled: false");
  });

  test("scopes monorepo working directory and cache paths", () => {
    const yaml = generatedText(defaultAdoptionOptions("monorepo-web-app"));

    expect(yaml).toContain("working_directory: apps/web");
    expect(yaml).toContain("bun_cache_dependency_path: apps/web/bun.lock");
  });
});

describe("adoption checker", () => {
  test("warns on moving refs", () => {
    const result = checkAdoptionYaml(`
name: Validate
jobs:
  fast:
    uses: moritzbrantner/reusable-workflows/.github/workflows/fast-validation.yml@main
    permissions:
      contents: read
      packages: read
`);

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "moving-workflow-ref", level: "warning" }),
    );
  });

  test("warns on inherited secrets", () => {
    const result = checkAdoptionYaml(`
name: Validate
jobs:
  fast:
    uses: moritzbrantner/reusable-workflows/.github/workflows/fast-validation.yml@workflow-standard-v1.2
    permissions:
      contents: read
      packages: read
    secrets: inherit
`);

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "inherited-secrets", level: "warning" }),
    );
  });

  test("warns on missing job permissions", () => {
    const result = checkAdoptionYaml(`
name: Validate
jobs:
  fast:
    uses: moritzbrantner/reusable-workflows/.github/workflows/fast-validation.yml@workflow-standard-v1.2
`);

    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "missing-job-permissions", level: "warning" }),
    );
  });

  test("formats JSON output shape", () => {
    const result = checkAdoptionYaml(`
name: Validate
jobs:
  fast:
    uses: moritzbrantner/reusable-workflows/.github/workflows/fast-validation.yml@main
`);

    expect(JSON.parse(formatAdoptionCheckResultAsJson(result))).toMatchObject({
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ code: "moving-workflow-ref" }),
      ]),
    });
  });
});

function generatedText(options: Parameters<typeof generateAdoptionWorkflows>[0]) {
  return combinedGeneratedWorkflowText(generateAdoptionWorkflows(options));
}
