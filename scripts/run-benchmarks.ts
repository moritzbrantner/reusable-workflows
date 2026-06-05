/* eslint-disable no-console */

import { mkdirSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

import workflowContracts from "../contracts/workflows.json";

const iterations = 10_000;
const startedAt = performance.now();

for (let index = 0; index < iterations; index += 1) {
  JSON.parse(JSON.stringify(workflowContracts));
}

const durationMs = performance.now() - startedAt;
const result = {
  benchmark: "workflow-contract-json-roundtrip",
  durationMs,
  iterations,
  operationsPerSecond: Math.round((iterations / durationMs) * 1000),
};

mkdirSync("benchmark-results", { recursive: true });
writeFileSync("benchmark-results/workflow-contracts.json", `${JSON.stringify(result, null, 2)}\n`);

console.log(
  `${result.benchmark}: ${result.operationsPerSecond} ops/s across ${result.iterations} iterations.`,
);
