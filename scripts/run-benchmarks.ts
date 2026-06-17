/* eslint-disable no-console */

import { mkdirSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

import workflowContracts from "../contracts/workflows.json";

const minSampleDurationMs = 250;
const sampleCount = 7;
const warmupIterations = 1_000;

runIterations(warmupIterations);

const samples = Array.from({ length: sampleCount }, runSample);
const medianSample = [...samples].sort(
  (left, right) => left.operationsPerSecond - right.operationsPerSecond,
)[Math.floor(samples.length / 2)];
const totalDurationMs = samples.reduce((total, sample) => total + sample.durationMs, 0);
const totalIterations = samples.reduce((total, sample) => total + sample.iterations, 0);

const result = {
  benchmark: "workflow-contract-json-roundtrip",
  durationMs: medianSample.durationMs,
  iterations: medianSample.iterations,
  operationsPerSecond: medianSample.operationsPerSecond,
  sampleCount,
  samples,
  totalDurationMs,
  totalIterations,
};

mkdirSync("benchmark-results", { recursive: true });
writeFileSync("benchmark-results/workflow-contracts.json", `${JSON.stringify(result, null, 2)}\n`);
writeFileSync(
  "benchmark-results/workflow-contracts.md",
  [
    "# Workflow Contract Benchmark",
    "",
    `- Benchmark: ${result.benchmark}`,
    `- Samples: ${result.sampleCount}`,
    `- Median iterations: ${result.iterations}`,
    `- Median duration: ${result.durationMs.toFixed(2)} ms`,
    `- Median throughput: ${result.operationsPerSecond} ops/s`,
    "",
  ].join("\n"),
);

console.log(
  `${result.benchmark}: median ${result.operationsPerSecond} ops/s across ${result.sampleCount} samples.`,
);

function runSample() {
  let iterations = 1_000;
  let durationMs = 0;

  while (durationMs < minSampleDurationMs) {
    const startedAt = performance.now();
    runIterations(iterations);
    durationMs = performance.now() - startedAt;

    if (durationMs < minSampleDurationMs) {
      iterations *= 2;
    }
  }

  return {
    durationMs,
    iterations,
    operationsPerSecond: Math.round((iterations / durationMs) * 1000),
  };
}

function runIterations(iterations: number) {
  for (let index = 0; index < iterations; index += 1) {
    JSON.parse(JSON.stringify(workflowContracts));
  }
}
