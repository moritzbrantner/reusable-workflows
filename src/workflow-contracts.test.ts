import { describe, expect, test } from "vitest";

import workflowContracts from "../contracts/workflows.json";

describe("workflow-standard-v1.3 compatibility snapshot", () => {
  test("keeps the released v1.3 interfaces available to the legacy reference UI", () => {
    expect(workflowContracts.workflow_standard).toBe("workflow-standard-v1.3");
    expect(Object.keys(workflowContracts.workflows)).toEqual(
      expect.arrayContaining([
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
      workflowContracts.workflows[".github/workflows/fast-validation.yml"].inputs,
    ).toHaveProperty("format_command");
    expect(
      workflowContracts.workflows[".github/workflows/fast-validation.yml"].inputs,
    ).toHaveProperty("unit_test_command");
  });
});
