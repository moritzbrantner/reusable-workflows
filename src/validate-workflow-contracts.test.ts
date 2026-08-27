import { describe, expect, test } from "vitest";

import { validateWorkflowContractsState } from "../scripts/validate-workflow-contracts";

const fastWorkflow = `
on:
  workflow_call:
    inputs:
      working_directory:
        required: false
        type: string
        default: "."
      node_version:
        required: false
        type: string
        default: "24"
      bun_version:
        required: false
        type: string
        default: "1.3.14"
      install_command:
        required: false
        type: string
        default: "bun install --frozen-lockfile"
      command:
        required: true
        type: string
      timeout_minutes:
        required: false
        type: number
        default: 20
jobs:
  fast-validation:
    permissions:
      contents: read
      packages: read
`;

const compatibilitySnapshot = {
  workflow_standard: "workflow-standard-v1.3",
  workflows: {
    ".github/workflows/fast-validation.yml": {
      inputs: {
        format_command: {},
        unit_test_command: {},
      },
    },
  },
};

function validate(customWorkflow: string) {
  return validateWorkflowContractsState({
    docs: {
      "README.md": "fast-validation.yml custom.yml",
      "CONTEXT.md": "fast-validation.yml custom.yml",
    },
    compatibilitySnapshot,
    workflowSources: {
      ".github/workflows/fast-validation.yml": fastWorkflow,
      ".github/workflows/custom.yml": customWorkflow,
    },
  });
}

describe("workflow capability validator", () => {
  test("accepts callable workflows with explicit permissions", () => {
    const errors = validate(`
on:
  workflow_call:
jobs:
  first:
    permissions:
      contents: read
  second:
    permissions:
      contents: read
`);

    expect(errors).toEqual([]);
  });

  test("fails when a callable job omits explicit permissions", () => {
    const errors = validate(`
on:
  workflow_call:
jobs:
  first:
    permissions:
      contents: read
  second:
    runs-on: ubuntu-latest
`);

    expect(errors).toContain(
      ".github/workflows/custom.yml job second must declare explicit permissions",
    );
  });

  test("keeps the released v1.3 compatibility snapshot explicit", () => {
    const errors = validateWorkflowContractsState({
      docs: {
        "README.md": "fast-validation.yml",
        "CONTEXT.md": "fast-validation.yml",
      },
      compatibilitySnapshot: {
        workflow_standard: "workflow-standard-v2",
        workflows: compatibilitySnapshot.workflows,
      },
      workflowSources: {
        ".github/workflows/fast-validation.yml": fastWorkflow,
      },
    });

    expect(errors).toContain(
      "contracts/workflows.json must remain the frozen workflow-standard-v1.3 snapshot",
    );
  });
});
