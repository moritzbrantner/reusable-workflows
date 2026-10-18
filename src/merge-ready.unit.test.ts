import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import { describe, expect, test } from "vitest";
import { parse } from "yaml";

// Exercise the actual Actions runtime script, not a second implementation.
const action = parse(readFileSync(".github/actions/merge-ready/action.yml", "utf8"));
const script: string = action.runs.steps[0].with.script;

function evaluate(needs: unknown, required: unknown = ["test"], allowed: unknown = []) {
  const failures: string[] = [];
  runInNewContext(script, {
    process: {
      env: {
        MERGE_NEEDS: JSON.stringify(needs),
        MERGE_REQUIRED: JSON.stringify(required),
        MERGE_ALLOW_SKIPPED: JSON.stringify(allowed),
      },
    },
    core: {
      setFailed: (message: string) => failures.push(message),
      info: () => undefined,
    },
  });
  return failures;
}

describe("merge-ready action", () => {
  test("accepts successful required validation", () => {
    expect(evaluate({ test: { result: "success" } })).toEqual([]);
  });

  test.each(["failure", "cancelled", "skipped", "pending", undefined])(
    "blocks a required result of %s",
    (result) => {
      expect(evaluate({ test: { result } })).toHaveLength(1);
    },
  );

  test("blocks missing validation even if a skip is allowed", () => {
    expect(evaluate({}, ["test"], ["test"])).toHaveLength(1);
  });

  test("ignores explicitly optional dependencies", () => {
    expect(evaluate({ test: { result: "success" }, optional: { result: "skipped" } })).toEqual([]);
  });

  test("permits docs-only scope after successful classification", () => {
    expect(
      evaluate(
        { scope: { result: "success" }, test: { result: "skipped" } },
        ["scope", "test"],
        ["test"],
      ),
    ).toEqual([]);
  });

  test.each(["failure", "cancelled"])("skip permission never hides %s", (result) => {
    expect(evaluate({ test: { result } }, ["test"], ["test"])).toHaveLength(1);
  });

  test.each([{ required: [] }, { required: ["test", "test"] }, { required: [""] }])(
    "rejects invalid required jobs $required",
    ({ required }) => {
      expect(() => evaluate({}, required)).toThrow();
    },
  );

  test("rejects unknown skip exceptions", () => {
    expect(() => evaluate({}, ["test"], ["typo"])).toThrow();
  });

  test("rejects malformed results", () => {
    expect(() => evaluate(null)).toThrow();
  });
});
