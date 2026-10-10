import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parsePilotMarker, recordResult } from "./record.mjs";

const sha = "0".repeat(40);
const task = {
  schemaVersion: 1,
  status: "passed",
  task: "deterministic-agent-validation-selection",
  fixtureSha256: createHash("sha256").update(readFileSync(new URL("./fixture.json", import.meta.url))).digest("hex"),
  cases: 4,
};
const log = "Hello\nOct 10 probe[1]: ENV_PILOT_RESULT=" + JSON.stringify(task) + "\n";

void test("accepts a single current task marker embedded in guest logs", () => {
  assert.deepEqual(parsePilotMarker(log), task);
  const result = recordResult({ candidate: "devcontainer", sourceSha: sha, start: 100, ready: 200, end: 250, log });
  assert.equal(result.totalElapsedMs, 150);
  assert.equal(result.timeToFirstTestMs, 100);
  assert.equal(result.status, "passed");
});

void test("NixOS VM overhead is not mislabeled as a native NixOS runner", () => {
  const result = recordResult({ candidate: "nixos-vm", sourceSha: sha, start: 100, ready: 300, end: 350, log });
  assert.equal(result.timeToFirstTestMs, null);
  assert.equal(result.isolation, "nested-qemu-guest");
  assert.equal(result.provisionElapsedMs, 200);
});

void test("a stale container fixture hash cannot pass even with a valid marker", () => {
  const stale = { ...task, fixtureSha256: "f".repeat(64) };
  const mismatchedLog = "ENV_PILOT_RESULT=" + JSON.stringify(stale);
  assert.throws(
    () => recordResult({ candidate: "devcontainer", sourceSha: sha, start: 100, ready: 200, end: 250, log: mismatchedLog }),
    /Guest task must use the exact checked-out fixture/,
  );
});

void test("guest boot without a test marker cannot count as successful acceptance", () => {
  assert.throws(() => parsePilotMarker("nixos booted but fixture never ran"), /one valid pilot marker/);
  assert.throws(() => parsePilotMarker(log + log), /one valid pilot marker/);
});

void test("unavailable KVM does not create a fake passing NixOS measurement", () => {
  const result = recordResult({
    candidate: "nixos-vm", sourceSha: sha, start: 100, ready: 120, end: 140,
    log: "", status: "unavailable", reason: "no-host-kvm",
  });
  assert.equal(result.task, null);
  assert.equal(result.status, "unavailable");
});
