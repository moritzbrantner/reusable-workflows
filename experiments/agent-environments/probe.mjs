import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// This is a dependency-free correctness probe, not a complete coding-agent task.
export function selectTests(changedFiles, dependencies) {
  const affected = new Set();
  for (const changed of changedFiles) {
    if (!/^src\/[a-z0-9-]+\.ts$/.test(changed)) return { mode: "full-required", tests: [] };
    const tests = dependencies[changed];
    if (!Array.isArray(tests) || tests.length === 0) return { mode: "full-required", tests: [] };
    for (const test of tests) affected.add(test);
  }
  return { mode: "affected", tests: [...affected].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)) };
}

export function verifyFixture(path) {
  const raw = readFileSync(path);
  const fixture = JSON.parse(raw.toString("utf8"));
  assert.equal(fixture.schemaVersion, 1);
  assert.equal(fixture.task, "deterministic-agent-validation-selection");
  assert.ok(Array.isArray(fixture.cases) && fixture.cases.length >= 3);
  for (const sample of fixture.cases) {
    assert.deepEqual(
      selectTests(sample.changedFiles, sample.dependencies),
      sample.expected,
      sample.id,
    );
  }
  return {
    fixtureSha256: createHash("sha256").update(raw).digest("hex"),
    cases: fixture.cases.length,
  };
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invoked) {
  const started = performance.now();
  const fixturePath = process.argv[2] ?? fileURLToPath(new URL("./fixture.json", import.meta.url));
  const evidence = verifyFixture(fixturePath);
  console.log(
    "ENV_PILOT_RESULT=" +
      JSON.stringify({
        schemaVersion: 1,
        status: "passed",
        task: "deterministic-agent-validation-selection",
        ...evidence,
        elapsedMs: Math.round(performance.now() - started),
        node: process.version,
        platform: process.platform,
        architecture: process.arch,
      }),
  );
}
