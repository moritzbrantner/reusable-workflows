import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { hostname, release } from "node:os";
import { performance } from "node:perf_hooks";

const startedAt = performance.now();
const fixturePath = process.argv[2] ?? new URL("./fixture.json", import.meta.url);
const source = readFileSync(fixturePath);
const fixture = JSON.parse(source.toString("utf8"));
assert.equal(fixture.schemaVersion, 1);

const graph = fixture.dependencyGraph;
const visited = new Set();
const visiting = new Set();
const order = [];

function visit(node) {
  assert.ok(Object.hasOwn(graph, node), `Unknown capability: ${node}`);
  if (visited.has(node)) return;
  assert.ok(!visiting.has(node), `Cyclic dependency: ${node}`);
  visiting.add(node);
  for (const dependency of [...graph[node]].sort()) visit(dependency);
  visiting.delete(node);
  visited.add(node);
  order.push(node);
}

for (const requested of [...fixture.requested].sort()) visit(requested);
assert.deepEqual(order, fixture.expectedOrder);

const osRelease = readFileSync("/etc/os-release", "utf8");
const osId = /^ID="?([^"\n]+)"?$/m.exec(osRelease)?.[1] ?? "unknown";
const expectedOs = process.argv[3];
if (expectedOs)
  assert.equal(osId, expectedOs, "The observed guest operating system must match the candidate");
const expectedNodeMajor = process.argv[4];
if (expectedNodeMajor)
  assert.equal(
    Number.parseInt(process.versions.node, 10),
    Number.parseInt(expectedNodeMajor, 10),
    "Unexpected Node.js major version",
  );

const digest = createHash("sha256");
for (let iteration = 0; iteration < 2048; iteration += 1)
  digest.update(`${iteration}:${order.join(",")}\n`);

const result = {
  schemaVersion: 1,
  workload: "ci-environment-smoke-v1",
  status: "passed",
  selectedChecks: order,
  fixtureSha256: createHash("sha256").update(source).digest("hex"),
  workloadSha256: digest.digest("hex"),
  nodeVersion: process.versions.node,
  platform: process.platform,
  architecture: process.arch,
  osId,
  kernelRelease: release(),
  hostname: hostname(),
  runtimeMs: Math.round((performance.now() - startedAt) * 100) / 100,
};
console.log(`CI_ENV_PILOT_RESULT=${JSON.stringify(result)}`);
