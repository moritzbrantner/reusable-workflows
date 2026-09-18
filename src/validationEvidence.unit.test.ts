import { createRequire } from "node:module";

import { describe, expect, test } from "vitest";

type Manifest = {
  schemaVersion: 1;
  globalInputs: string[];
  ignoredInputs: string[];
  units: Record<string, { inputs: string[]; dependsOn: string[] }>;
};

type Identity = {
  unit: string;
  unitClosure: string[];
  declaredPatterns: string[];
  manifest: {
    globalInputs: string[];
    units: Record<string, { inputs: string[]; dependsOn: string[] }>;
  };
  execution: {
    workingDirectory: string;
    setupCommand: string;
    command: string;
    environmentIdentity: string;
    capabilityIdentity: string;
    runnerOs: string;
    runnerArch: string;
    runnerImageIdentity: string;
  };
  inputFiles: Array<{ path: string; mode: string; digest: string }>;
};

type Resolver = {
  buildIdentity: (input: {
    unitName: string;
    manifest: Manifest;
    workingDirectory: string;
    setupCommand: string;
    command: string;
    environmentIdentity: string;
    capabilityIdentity: string;
    inputFiles: Array<{ path: string; mode: string; digest: string }>;
    runnerOs?: string;
    runnerArch?: string;
    runnerImageIdentity?: string;
  }) => Identity;
  collectUnitClosure: (units: Manifest["units"], unitName: string) => string[];
  digestIdentity: (identity: Identity) => string;
};

const require = createRequire(import.meta.url);
const resolver = require("../.github/actions/resolve-validation-evidence/resolver.cjs") as Resolver;

function manifest(): Manifest {
  return {
    schemaVersion: 1,
    globalInputs: ["bun.lock", "package.json"],
    ignoredInputs: ["docs/**"],
    units: {
      core: { inputs: ["src/core/**"], dependsOn: [] },
      docs: { inputs: ["docs/**"], dependsOn: [] },
      ui: { inputs: ["src/ui/**"], dependsOn: ["core"] },
    },
  };
}

function identity(overrides: Partial<Parameters<Resolver["buildIdentity"]>[0]> = {}) {
  return resolver.buildIdentity({
    unitName: "ui",
    manifest: manifest(),
    workingDirectory: ".",
    setupCommand: "bun install --frozen-lockfile",
    command: "bun run test:unit",
    environmentIdentity: "bun-1.4.0",
    capabilityIdentity:
      "moritzbrantner/reusable-workflows@ffffffffffffffffffffffffffffffffffffffff",
    inputFiles: [
      { path: "bun.lock", mode: "100644", digest: `sha256:${"a".repeat(64)}` },
      { path: "package.json", mode: "100644", digest: `sha256:${"b".repeat(64)}` },
      { path: "src/core/model.ts", mode: "100644", digest: `sha256:${"c".repeat(64)}` },
      { path: "src/ui/view.tsx", mode: "100644", digest: `sha256:${"d".repeat(64)}` },
    ],
    runnerOs: "Linux",
    runnerArch: "X64",
    runnerImageIdentity: "ubuntu24@20260901.1",
    ...overrides,
  });
}

describe("validation evidence fingerprint identity", () => {
  test("includes dependency inputs and global inputs, but excludes unrelated units", () => {
    const result = identity();

    expect(result.unitClosure).toEqual(["core", "ui"]);
    expect(result.declaredPatterns).toEqual([
      "bun.lock",
      "package.json",
      "src/core/**",
      "src/ui/**",
    ]);
    expect(result.manifest.units).toEqual({
      core: { inputs: ["src/core/**"], dependsOn: [] },
      ui: { inputs: ["src/ui/**"], dependsOn: ["core"] },
    });
    expect(result.manifest.units).not.toHaveProperty("docs");
  });

  test("changes the fingerprint for declared input, execution, or environment changes", () => {
    const base = identity();
    const baseDigest = resolver.digestIdentity(base);

    const changedInput = identity({
      inputFiles: base.inputFiles.map((entry) =>
        entry.path === "src/ui/view.tsx" ? { ...entry, digest: `sha256:${"e".repeat(64)}` } : entry,
      ),
    });
    const changedCommand = identity({ command: "bun run test:integration" });
    const changedEnvironment = identity({ environmentIdentity: "bun-1.4.1" });
    const changedCapability = identity({
      capabilityIdentity:
        "moritzbrantner/reusable-workflows@1111111111111111111111111111111111111111",
    });
    const changedRunnerImage = identity({
      runnerImageIdentity: "ubuntu24@20260908.1",
    });
    const changedMode = identity({
      inputFiles: base.inputFiles.map((entry) =>
        entry.path === "src/ui/view.tsx" ? { ...entry, mode: "100755" } : entry,
      ),
    });

    expect(resolver.digestIdentity(changedInput)).not.toBe(baseDigest);
    expect(resolver.digestIdentity(changedCommand)).not.toBe(baseDigest);
    expect(resolver.digestIdentity(changedEnvironment)).not.toBe(baseDigest);
    expect(resolver.digestIdentity(changedCapability)).not.toBe(baseDigest);
    expect(resolver.digestIdentity(changedRunnerImage)).not.toBe(baseDigest);
    expect(resolver.digestIdentity(changedMode)).not.toBe(baseDigest);
  });

  test("does not invalidate a fingerprint for an unrelated manifest unit", () => {
    const base = identity();
    const changedManifest = manifest();
    changedManifest.units.docs.inputs = ["guides/**"];

    const changed = identity({ manifest: changedManifest });

    expect(resolver.digestIdentity(changed)).toBe(resolver.digestIdentity(base));
  });

  test("keeps source coordinates outside the reusable identity", () => {
    const result = identity();

    expect(result).not.toHaveProperty("source");
    expect(resolver.digestIdentity(result)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  test("rejects unknown validation units", () => {
    expect(() => resolver.collectUnitClosure(manifest().units, "missing")).toThrow(
      "is not declared",
    );
  });
});
