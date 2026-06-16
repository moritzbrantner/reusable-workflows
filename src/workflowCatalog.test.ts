import { readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { parsedWorkflows, parsedWorkflowsByFile } from "./app/workflowCatalog";
import { parseWorkflowForCatalog } from "../scripts/workflow-catalog-data";

const workflowsDir = path.resolve(import.meta.dirname, "..", ".github", "workflows");

describe("workflow catalog", () => {
  test("includes every local workflow file", () => {
    const workflowFiles = readdirSync(workflowsDir)
      .filter((fileName) => fileName.endsWith(".yml"))
      .map((fileName) => `.github/workflows/${fileName}`)
      .sort();

    expect(parsedWorkflows.map((workflow) => workflow.file).sort()).toEqual(workflowFiles);
  });

  test("classifies reusable workflows and caller workflows with canonical role names", () => {
    const deployPagesWorkflow = parsedWorkflowsByFile.get(".github/workflows/deploy-pages.yml");
    const validateWorkflow = parsedWorkflowsByFile.get(".github/workflows/validate.yml");

    expect(deployPagesWorkflow?.role).toBe("Reusable Workflow");
    expect(validateWorkflow?.role).toBe("Caller Workflow");
    expect(parsedWorkflows[0]?.role).toBe("Reusable Workflow");
  });

  test("parses validate.yml triggers and reusable workflow dependencies", () => {
    const validateWorkflow = parsedWorkflowsByFile.get(".github/workflows/validate.yml");

    expect(validateWorkflow?.triggers).toEqual(["push", "pull_request", "workflow_dispatch"]);
    expect(validateWorkflow?.dependencies).toEqual(
      expect.arrayContaining([
        ".github/workflows/e2e-validation.yml",
        ".github/workflows/fast-validation.yml",
        ".github/workflows/integration-validation.yml",
        ".github/workflows/link-validation.yml",
        ".github/workflows/performance-validation.yml",
        ".github/workflows/stage-validation.yml",
        ".github/workflows/storybook-validation.yml",
        ".github/workflows/validate-repo.yml",
      ]),
    );
  });

  test("parses deploy-pages.yml job metadata and contract inputs", () => {
    const deployPagesWorkflow = parsedWorkflowsByFile.get(".github/workflows/deploy-pages.yml");

    expect(deployPagesWorkflow?.yamlName).toBe("Deploy Pages");
    expect(deployPagesWorkflow?.triggers).toEqual(["workflow_call"]);
    expect(deployPagesWorkflow?.contract?.inputs).toHaveProperty("artifact_path");
    expect(deployPagesWorkflow?.jobs).toEqual([
      expect.objectContaining({
        id: "deploy-pages",
        name: "Deploy Pages",
        runsOn: "ubuntu-latest",
        stepCount: 11,
      }),
    ]);
  });

  test("normalizes array-style needs and runs-on values", () => {
    const parsed = parseWorkflowForCatalog(`
name: Matrix Workflow
on: [push, workflow_dispatch]
jobs:
  prepare:
    runs-on: ubuntu-latest
    steps:
      - run: echo prepare
  validate:
    name: Validate Matrix
    needs: [prepare, setup]
    runs-on: [self-hosted, linux]
    timeout-minutes: 12
    steps:
      - uses: actions/checkout@v6
      - run: echo validate
`);

    expect(parsed.yamlName).toBe("Matrix Workflow");
    expect(parsed.triggers).toEqual(["push", "workflow_dispatch"]);
    expect(parsed.jobs).toContainEqual(
      expect.objectContaining({
        id: "validate",
        name: "Validate Matrix",
        needs: ["prepare", "setup"],
        runsOn: "self-hosted, linux",
        stepCount: 2,
        timeoutMinutes: 12,
      }),
    );
  });
});
