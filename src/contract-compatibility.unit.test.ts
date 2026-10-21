import { describe, expect, test } from "vitest";

import { compareCapabilityContracts } from "../scripts/check-contract-compatibility";
import { generateCapabilityManifest } from "../scripts/generate-workflow-manifest";

const publishedPath = ".github/workflows/command-validation.yml";

const published = `
on:
  workflow_call:
    inputs:
      command:
        required: true
        type: string
      timeout_minutes:
        required: false
        type: number
        default: 20
    secrets:
      token:
        required: false
    outputs:
      outcome:
        value: \${{ jobs.run.outputs.outcome }}
jobs:
  run:
    permissions:
      contents: read
`;

function contracts(sources: Record<string, string>) {
  return generateCapabilityManifest(sources).workflows;
}

function check(headSources: Record<string, string>, retired = {}) {
  return compareCapabilityContracts(
    contracts({ [publishedPath]: published }),
    contracts(headSources),
    retired,
  );
}

function evolve(from: string, to: string) {
  expect(published).toContain(from);
  return { [publishedPath]: published.replace(from, to) };
}

describe("independent capability contract compatibility", () => {
  test("accepts additive optional inputs, secrets and outputs for pinned consumers", () => {
    const head = evolve(
      "    secrets:\n",
      '      working_directory:\n        required: false\n        type: string\n        default: "."\n    secrets:\n      extra:\n        required: false\n',
    );
    head[publishedPath] = head[publishedPath].replace(
      "    outputs:\n",
      "    outputs:\n      report_path:\n        value: x\n",
    );

    expect(check(head)).toEqual([]);
    // A consumer pinned to the published contract still resolves every input it used.
    expect(contracts(head)[publishedPath].inputs).toMatchObject(
      contracts({ [publishedPath]: published })[publishedPath].inputs,
    );
  });

  test("rejects an in-place required input addition", () => {
    const errors = check(
      evolve(
        "    secrets:\n",
        "      mode:\n        required: true\n        type: string\n    secrets:\n",
      ),
    );
    expect(errors).toEqual([expect.stringContaining("new input 'mode' is required")]);
    expect(errors[0]).toContain("separately versioned workflow file");
  });

  test("rejects removed or renamed paths, inputs and outputs", () => {
    expect(check({})).toEqual([expect.stringContaining("callable workflow was removed")]);
    expect(check(evolve("      command:\n", "      run_command:\n"))).toEqual(
      expect.arrayContaining([expect.stringContaining("input 'command' was removed")]),
    );
    expect(check(evolve("      outcome:\n", "      result:\n"))).toEqual([
      expect.stringContaining("output 'outcome' was removed"),
    ]);
  });

  test("rejects incompatible secret, type, requiredness and default changes", () => {
    expect(
      check(
        evolve("      token:\n        required: false", "      token:\n        required: true"),
      ),
    ).toEqual([expect.stringContaining("secret 'token' changed from optional to required")]);
    expect(check(evolve("type: number", "type: string"))).toEqual([
      expect.stringContaining("input 'timeout_minutes' changed type"),
    ]);
    expect(check(evolve("default: 20", "default: 30"))).toEqual([
      expect.stringContaining("input 'timeout_minutes' changed default"),
    ]);
  });

  test("a separately versioned workflow carries the breaking interface beside the old contract", () => {
    const breaking = published.replace("      command:\n", "      commands:\n");
    expect(
      check({
        [publishedPath]: published,
        ".github/workflows/command-validation-v2.yml": breaking,
      }),
    ).toEqual([]);
  });

  test("allows retiring a migrated path only with replacement and migration guidance", () => {
    expect(
      check(
        {},
        {
          [publishedPath]: {
            replacement: ".github/workflows/command-validation-v2.yml",
            migration: "Rename the command input to commands.",
          },
        },
      ),
    ).toEqual([]);
    expect(check({}, { [publishedPath]: { replacement: "", migration: "" } })).toEqual([
      expect.stringContaining("needs replacement and migration"),
    ]);
  });
});
