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

  test("requires an immutable coding-tooling Action pin", () => {
    const codingToolingWorkflow = `
on:
  workflow_call:
    inputs:
      operation:
        required: false
        type: string
        default: run
      tier:
        required: false
        type: string
        default: fast
jobs:
  coding-tooling:
    permissions:
      contents: read
    steps:
      - uses: moritzbrantner/coding-tooling@main
`;
    const errors = validateWorkflowContractsState({
      docs: {
        "README.md": "fast-validation.yml coding-tooling-validation.yml",
        "CONTEXT.md": "fast-validation.yml coding-tooling-validation.yml",
      },
      compatibilitySnapshot,
      workflowSources: {
        ".github/workflows/fast-validation.yml": fastWorkflow,
        ".github/workflows/coding-tooling-validation.yml": codingToolingWorkflow,
      },
    });

    expect(errors).toContain(
      "coding-tooling-validation.yml must pin moritzbrantner/coding-tooling to an exact commit SHA",
    );
  });

  test("requires the coding-tooling operation input", () => {
    const codingToolingWorkflow = `
on:
  workflow_call:
    inputs:
      tier:
        required: false
        type: string
        default: fast
jobs:
  coding-tooling:
    permissions:
      contents: read
    steps:
      - uses: moritzbrantner/coding-tooling@c8682a4804397f82099bd7f567ac4a6e8a18658e
`;
    const errors = validateWorkflowContractsState({
      docs: {
        "README.md": "fast-validation.yml coding-tooling-validation.yml",
        "CONTEXT.md": "fast-validation.yml coding-tooling-validation.yml",
      },
      compatibilitySnapshot,
      workflowSources: {
        ".github/workflows/fast-validation.yml": fastWorkflow,
        ".github/workflows/coding-tooling-validation.yml": codingToolingWorkflow,
      },
    });

    expect(errors).toContain(
      "coding-tooling-validation.yml must expose the coding-tooling operation input",
    );
  });

  test("locks the execution receipt schema identity and core fields", () => {
    const errors = validateWorkflowContractsState({
      docs: {
        "README.md": "fast-validation.yml",
        "CONTEXT.md": "fast-validation.yml",
      },
      compatibilitySnapshot,
      workflowSources: {
        ".github/workflows/fast-validation.yml": fastWorkflow,
      },
      executionReceiptSchema: {
        required: ["schemaVersion"],
        properties: {
          schemaVersion: { const: 2 },
          kind: { const: "other/receipt" },
        },
      },
    });

    expect(errors).toContain("execution receipt v1 schema must lock schema version and kind");
    expect(errors).toContain("execution receipt v1 schema must require capability");
    expect(errors).toContain("execution receipt v1 schema must require evidence");
  });
});
