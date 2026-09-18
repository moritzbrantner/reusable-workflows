import { createRequire } from "node:module";

import { describe, expect, test } from "vitest";

type ImpactManifest = {
  schemaVersion: 1;
  globalInputs: string[];
  ignoredInputs: string[];
  units: Record<string, { inputs: string[]; dependsOn: string[] }>;
};

type ImpactPlan = {
  changedFiles: string[];
  invalidatedUnits: string[];
  directInvalidatedUnits: string[];
  dependencyInvalidatedUnits: string[];
  reusableUnits: string[];
  ignoredFiles: string[];
  unclassifiedFiles: string[];
  globalFiles: string[];
  fullValidation: boolean;
  reasons: string[];
};

type Resolver = {
  globToRegExp: (pattern: string) => RegExp;
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
const baseSha = "a".repeat(40);
const headSha = "b".repeat(40);

function manifest() {
  return resolver.parseManifest({
    schemaVersion: 1,
    globalInputs: ["package.json", "bun.lock"],
    ignoredInputs: ["docs/**", "**/*.md"],
    units: {
      core: {
        inputs: ["src/core/**"],
      },
      ui: {
        inputs: ["src/ui/**"],
        dependsOn: ["core"],
      },
      e2e: {
        inputs: ["tests/e2e/**", "playwright.config.ts"],
        dependsOn: ["ui"],
      },
      contracts: {
        inputs: ["contracts/**"],
      },
    },
  });
}

function plan(changedFiles: string[]) {
  return resolver.resolveImpactPlan({
    baseSha,
    headSha,
    manifestPath: ".github/validation-impact.json",
    changedFiles,
    manifest: manifest(),
  });
}

describe("validation impact resolver", () => {
  test("invalidates direct units and their dependent closure without retesting unrelated units", () => {
    const result = plan(["src/core/solver.ts"]);

    expect(result.fullValidation).toBe(false);
    expect(result.directInvalidatedUnits).toEqual(["core"]);
    expect(result.dependencyInvalidatedUnits).toEqual(["e2e", "ui"]);
    expect(result.invalidatedUnits).toEqual(["core", "e2e", "ui"]);
    expect(result.reusableUnits).toEqual(["contracts"]);
  });

  test("allows explicitly ignored changes to reuse all validation units", () => {
    const result = plan(["docs/validation.md", "README.md"]);

    expect(result.fullValidation).toBe(false);
    expect(result.invalidatedUnits).toEqual([]);
    expect(result.reusableUnits).toEqual(["contracts", "core", "e2e", "ui"]);
    expect(result.ignoredFiles).toEqual(["README.md", "docs/validation.md"]);
  });

  test("fails closed when a changed path has not been classified", () => {
    const result = plan(["tools/new-check.ts"]);

    expect(result.fullValidation).toBe(true);
    expect(result.invalidatedUnits).toEqual(["contracts", "core", "e2e", "ui"]);
    expect(result.reusableUnits).toEqual([]);
    expect(result.unclassifiedFiles).toEqual(["tools/new-check.ts"]);
    expect(result.reasons).toEqual(["unclassified-input"]);
  });

  test("runs every unit for an explicitly global input", () => {
    const result = plan(["package.json"]);

    expect(result.fullValidation).toBe(true);
    expect(result.invalidatedUnits).toEqual(["contracts", "core", "e2e", "ui"]);
    expect(result.globalFiles).toEqual(["package.json"]);
    expect(result.reasons).toEqual(["global-input-changed"]);
  });

  test("fails closed when the impact manifest changes", () => {
    const result = plan([".github/validation-impact.json"]);

    expect(result.fullValidation).toBe(true);
    expect(result.invalidatedUnits).toEqual(["contracts", "core", "e2e", "ui"]);
    expect(result.reasons).toEqual(["impact-manifest-changed"]);
  });

  test("rejects unknown dependencies and cycles", () => {
    expect(() =>
      resolver.parseManifest({
        schemaVersion: 1,
        units: {
          api: { inputs: ["src/api/**"], dependsOn: ["missing"] },
        },
      }),
    ).toThrow("unknown unit");

    expect(() =>
      resolver.parseManifest({
        schemaVersion: 1,
        units: {
          api: { dependsOn: ["web"] },
          web: { dependsOn: ["api"] },
        },
      }),
    ).toThrow("cycle");
  });

  test("uses small repository-relative glob semantics", () => {
    expect(resolver.globToRegExp("**/*.md").test("README.md")).toBe(true);
    expect(resolver.globToRegExp("**/*.md").test("docs/guide.md")).toBe(true);
    expect(resolver.globToRegExp("src/*/index.ts").test("src/core/index.ts")).toBe(true);
    expect(resolver.globToRegExp("src/*/index.ts").test("src/core/nested/index.ts")).toBe(false);
  });
});
