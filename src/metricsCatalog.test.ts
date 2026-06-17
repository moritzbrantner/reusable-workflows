import { describe, expect, test } from "vitest";

import type { BuildMetricsEntry } from "./build-metrics";
import { createMetricsChartRows } from "./app/metricsCatalog";

describe("metrics catalog", () => {
  test("indexes lower-is-better and higher-is-better metrics against the oldest visible run", () => {
    const rows = createMetricsChartRows([
      makeBuild({
        benchmarkOps: 80,
        buildMs: 1500,
        jsBytes: 150000,
        lighthouseScore: 0.72,
        runNumber: 3,
      }),
      makeBuild({
        benchmarkOps: 120,
        buildMs: 900,
        jsBytes: 90000,
        lighthouseScore: 0.99,
        runNumber: 2,
      }),
      makeBuild({
        benchmarkOps: 100,
        buildMs: 1000,
        jsBytes: 100000,
        lighthouseScore: 0.9,
        runNumber: 1,
      }),
    ]);

    expect(rows.map((row) => row.runLabel)).toEqual(["#1", "#2", "#3"]);
    expect(rows[0]).toMatchObject({
      benchmark: 100,
      build: 100,
      bundle: 100,
      lighthouse: 100,
    });
    expect(rows[2]).toMatchObject({
      benchmark: 80,
      build: 66.7,
      bundle: 66.7,
      lighthouse: 80,
    });
  });
});

function makeBuild({
  benchmarkOps,
  buildMs,
  jsBytes,
  lighthouseScore,
  runNumber,
}: {
  benchmarkOps: number;
  buildMs: number;
  jsBytes: number;
  lighthouseScore: number;
  runNumber: number;
}): BuildMetricsEntry {
  return {
    id: `${runNumber}-1`,
    runId: runNumber,
    runNumber,
    runAttempt: 1,
    event: "push",
    branch: "main",
    commitSha: "1234567890abcdef",
    commitShortSha: "1234567",
    commitUrl: "https://github.com/moritzbrantner/reusable-workflows/commit/1234567890abcdef",
    runUrl: `https://github.com/moritzbrantner/reusable-workflows/actions/runs/${runNumber}/attempts/1`,
    startedAt: "2026-06-07T12:00:00.000Z",
    completedAt: `2026-06-07T12:0${runNumber}:00.000Z`,
    status: "success",
    durations: { buildMs },
    bundle: {
      budgetBytes: 430080,
      cssBudgetBytes: 122880,
      cssBytes: 20000,
      cssWithinBudget: true,
      jsBytes,
      withinBudget: true,
    },
    benchmark: {
      name: "workflow-contract-json-roundtrip",
      durationMs: 250,
      iterations: 1000,
      operationsPerSecond: benchmarkOps,
    },
    lighthouse: {
      score: lighthouseScore,
      categories: {
        performance: lighthouseScore,
        accessibility: 1,
        bestPractices: 0.96,
        seo: 0.91,
      },
      metrics: {
        firstContentfulPaintMs: 1200,
        largestContentfulPaintMs: 1350,
        cumulativeLayoutShift: 0,
        totalBlockingTimeMs: 0,
        timeToInteractiveMs: 1350,
        maxPotentialFidMs: 16,
      },
    },
  };
}
