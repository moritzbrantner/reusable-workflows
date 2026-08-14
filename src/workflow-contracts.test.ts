import { describe, expect, test } from "vitest";

import workflowContracts from "../contracts/workflows.json";

describe("workflow contract data", () => {
  test("documents the workflow-standard-v1.3 reusable workflow family", () => {
    expect(workflowContracts.workflow_standard).toBe("workflow-standard-v1.3");
    expect(Object.keys(workflowContracts.workflows)).toEqual(
      expect.arrayContaining([
        ".github/workflows/coding-tooling-validation.yml",
        ".github/workflows/fast-validation.yml",
        ".github/workflows/link-validation.yml",
        ".github/workflows/storybook-validation.yml",
        ".github/workflows/performance-validation.yml",
        ".github/workflows/deploy-pages.yml",
        ".github/workflows/external-pull.yml",
        ".github/workflows/package-publish.yml",
      ]),
    );
    expect(
      workflowContracts.workflows[".github/workflows/performance-validation.yml"].inputs,
    ).toHaveProperty("metrics_command");
    expect(
      workflowContracts.workflows[".github/workflows/package-publish.yml"].inputs,
    ).toHaveProperty("package_manager");
    expect(
      workflowContracts.workflows[".github/workflows/external-pull.yml"].inputs,
    ).toHaveProperty("request_timeout_seconds");
  });
});
