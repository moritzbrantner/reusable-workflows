import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export function parsePilotMarker(log) {
  const found = log.split(/\r?\n/).flatMap((line) => {
    const index = line.indexOf("ENV_PILOT_RESULT=");
    if (index < 0) return [];
    const json = line.slice(index + "ENV_PILOT_RESULT=".length).trim();
    try {
      return [JSON.parse(json)];
    } catch {
      return [];
    }
  });
  if (found.length !== 1)
    throw new Error("Expected exactly one valid pilot marker, got " + found.length);
  const marker = found[0];
  assert.equal(marker.schemaVersion, 1);
  assert.equal(marker.status, "passed");
  assert.equal(marker.task, "deterministic-agent-validation-selection");
  assert.match(marker.fixtureSha256, /^[a-f0-9]{64}$/);
  assert.equal(marker.cases, 4);
  return marker;
}

export function recordResult({
  candidate,
  sourceSha,
  start,
  ready,
  end,
  log,
  status = "passed",
  reason = null,
  image = null,
}) {
  if (!["ubuntu", "devcontainer", "nixos-vm"].includes(candidate))
    throw new Error("Unrecognized candidate");
  if (!/^[0-9a-f]{40}$/.test(sourceSha)) throw new Error("Source revision must be a full SHA");
  for (const value of [start, ready, end]) {
    if (!Number.isFinite(value) || value <= 0) throw new Error("Missing timing value");
  }
  if (start > ready || ready > end) throw new Error("Timer order invalid");
  if (!["passed", "unavailable"].includes(status)) throw new Error("Unsupported status");
  if (status === "unavailable" && !reason) throw new Error("Unavailable result needs a reason");
  const task = status === "passed" ? parsePilotMarker(log) : null;
  if (task) {
    const fixturePath = fileURLToPath(new URL("./fixture.json", import.meta.url));
    const expectedHash = createHash("sha256").update(readFileSync(fixturePath)).digest("hex");
    assert.equal(
      task.fixtureSha256,
      expectedHash,
      "Guest task must use the exact checked-out fixture",
    );
  }
  return {
    schemaVersion: 1,
    candidate,
    status,
    reason,
    sourceSha,
    runId: process.env.GITHUB_RUN_ID ?? null,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    runnerLabel: "ubuntu-24.04",
    runnerImageVersion: process.env.PILOT_RUNNER_IMAGE_VERSION ?? null,
    isolation:
      candidate === "nixos-vm"
        ? "nested-qemu-guest"
        : candidate === "devcontainer"
          ? "oci-on-ubuntu-host"
          : "github-ubuntu-vm",
    imageDigest: image,
    cacheClass: "fresh-github-host-no-persisted-environment-cache",
    timeToFirstTestMs: candidate === "nixos-vm" ? null : ready - start,
    provisionElapsedMs: ready - start,
    executionElapsedMs: end - ready,
    totalElapsedMs: end - start,
    task,
    note: "Small correctness probe only; does not measure full coding-agent task completion or p95 throughput",
  };
}

function args(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith("--") || !argv[i + 1])
      throw new Error("Expected --key value arguments");
    parsed[argv[i].slice(2)] = argv[i + 1];
  }
  return parsed;
}

if (process.argv[1]?.endsWith("/record.mjs")) {
  const opt = args(process.argv.slice(2));
  const entry = recordResult({
    candidate: opt.candidate,
    sourceSha: opt.sha,
    start: Number(opt.start),
    ready: Number(opt.ready),
    end: Number(opt.end),
    log: opt.log ? readFileSync(opt.log, "utf8") : "",
    status: opt.status ?? "passed",
    reason: opt.reason ?? null,
    image: opt.image ?? null,
  });
  const out = opt.out ?? ".artifacts/environment-pilot.json";
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(entry, null, 2) + "\n");
  console.log(JSON.stringify(entry));
}
