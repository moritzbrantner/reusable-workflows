import { describe, expect, test } from "vitest";

import { validateWorkflowContractsState } from "../scripts/validate-workflow-contracts";

const docs = {
  "README.md": "workflow-standard-v1.3 custom.yml",
  "SCAFFOLD_ALIGNMENT.md": "workflow-standard-v1.3 custom.yml",
};

const matchingContract = {
  ".github/workflows/custom.yml": {
    inputs: {},
    permissions: {
      contents: "read",
    },
  },
};

function validateWorkflowSource(source: string) {
  return validateWorkflowContractsState({
    docs,
    repoWorkflowPaths: [".github/workflows/custom.yml"],
    workflowStandard: "workflow-standard-v1.3",
    workflows: matchingContract,
    workflowSources: {
      ".github/workflows/custom.yml": source,
    },
  });
}

describe("workflow contract validator", () => {
  test("accepts matching permissions across every job", () => {
    const errors = validateWorkflowSource(`
on:
  workflow_call:
    inputs: {}
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

  test("fails when a later job declares extra permissions", () => {
    const errors = validateWorkflowSource(`
on:
  workflow_call:
    inputs: {}
jobs:
  first:
    permissions:
      contents: read
  second:
    permissions:
      contents: read
      issues: write
`);

    expect(errors).toContain(
      "Permission contract drift in .github/workflows/custom.yml job second",
    );
  });

  test("fails when a later job omits documented permissions", () => {
    const errors = validateWorkflowSource(`
on:
  workflow_call:
    inputs: {}
jobs:
  first:
    permissions:
      contents: read
  second:
    runs-on: ubuntu-latest
`);

    expect(errors).toContain(
      "Permission contract drift in .github/workflows/custom.yml job second",
    );
  });
});
