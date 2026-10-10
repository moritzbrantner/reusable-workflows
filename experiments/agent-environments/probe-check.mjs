import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { selectTests, verifyFixture } from "./probe.mjs";

const fixturePath = fileURLToPath(new URL("./fixture.json", import.meta.url));

void test("pilot task has independent fixture expectations", () => {
  assert.equal(verifyFixture(fixturePath).cases, 4);
});

void test("unmapped input fails closed, never silently selects zero tests", () => {
  assert.deepEqual(selectTests(["src/other.ts"], {}), { mode: "full-required", tests: [] });
});

void test("selection is deterministic and deduplicated", () => {
  const deps = { "src/a.ts": ["b", "a"], "src/b.ts": ["b"] };
  assert.deepEqual(selectTests(["src/b.ts", "src/a.ts"], deps), {
    mode: "affected",
    tests: ["a", "b"],
  });
});
