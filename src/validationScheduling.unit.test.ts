import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

type ImpactManifest = {
  schemaVersion: 1;
  globalInputs: string[];
  ignoredInputs: string[];
  units: Record<string, { inputs: string[]; dependsOn: string[] }>;
};

type ImpactPlan = {
  invalidatedUnits: string[];
  reusableUnits: string[];
  fullValidation: boolean;
  reasons: string[];
};

type Resolver = {
  parseManifest: (value: unknown) => ImpactManifest;
  resolveImpactPlan: (input: {
    baseSha: string;
    headSha: string;
    manifestPath: string;
    changedFiles: string[];
    manifest: ImpactManifest;
  }) => ImpactPlan;
};

const require = createRequire(import.meta.url);
const resolver = require("../.github/actions/resolve-validation-impact/resolver.cjs") as Resolver;
const manifestPath = ".github/validation-impact.json";
const manifest = resolver.parseManifest(
  JSON.parse(readFileSync(new URL("../.github/validation-impact.json", import.meta.url), "utf8")),
);
const baseSha = "a".repeat(40);
const headSha = "b".repeat(40);

function plan(changedFiles: string[]) {
  return resolver.resolveImpactPlan({
    baseSha,
    headSha,
    manifestPath,
    changedFiles,
    manifest,
  });
}

describe("repository validation impact scheduling", () => {
  test("keeps documentation changes on the semantic lane only", () => {
    const result = plan(["docs/validation-evidence.md"]);

    expect(result.fullValidation).toBe(false);
    expect(result.invalidatedUnits).toEqual(["semantic"]);
    expect(result.reusableUnits).toEqual(["actionlint", "web-build"]);
  });

  test("invalidates the web build for application source changes", () => {
    const result = plan(["src/pages/HomePage.tsx"]);

    expect(result.fullValidation).toBe(false);
    expect(result.invalidatedUnits).toEqual(["semantic", "web-build"]);
    expect(result.reusableUnits).toEqual(["actionlint"]);
  });

  test("invalidates actionlint and the web build for workflow changes", () => {
    const result = plan([".github/workflows/validate.yml"]);

    expect(result.fullValidation).toBe(false);
    expect(result.invalidatedUnits).toEqual(["actionlint", "semantic", "web-build"]);
    expect(result.reusableUnits).toEqual([]);
  });

  test("keeps package changes out of actionlint while rebuilding", () => {
    const result = plan(["package.json"]);

    expect(result.fullValidation).toBe(false);
    expect(result.invalidatedUnits).toEqual(["semantic", "web-build"]);
    expect(result.reusableUnits).toEqual(["actionlint"]);
  });

  test("fails closed when the live impact policy changes", () => {
    const result = plan([manifestPath]);

    expect(result.fullValidation).toBe(true);
    expect(result.invalidatedUnits).toEqual(["actionlint", "semantic", "web-build"]);
    expect(result.reasons).toEqual(["impact-manifest-changed"]);
  });

  test("wires PR impact outputs into expensive validation lanes", () => {
    const validate = readFileSync(
      new URL("../.github/workflows/validate.yml", import.meta.url),
      "utf8",
    );
    const smoke = readFileSync(
      new URL("../.github/workflows/smoke-reusable-workflows.yml", import.meta.url),
      "utf8",
    );

    expect(validate).toContain("uses: ./.github/workflows/validation-impact.yml");
    expect(validate).toContain(
      "contains(needs.validation-impact.outputs.invalidated_units_json, '\"web-build\"')",
    );
    expect(validate).toContain(
      "contains(needs.validation-impact.outputs.invalidated_units_json, '\"actionlint\"')",
    );
    expect(validate).toContain("needs.validation-impact.outputs.full_validation == 'true'");
    expect(smoke).toMatch(/push:\n\s+branches:\n\s+- main\n\s+paths:/);
  });
});
