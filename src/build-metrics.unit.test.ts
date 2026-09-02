import { describe, expect, test } from "vitest";

import {
  buildMetricsEntryFromReports,
  emptyBuildMetricsHistory,
  mergeBuildMetricsHistory,
  normalizeBuildMetricsHistory,
  parseJsonObject,
  type BuildMetricsEntry,
} from "./build-metrics";

const env = {
  GITHUB_REPOSITORY: "moritzbrantner/reusable-workflows",
  GITHUB_RUN_ID: "100",
  GITHUB_RUN_NUMBER: "23",
  GITHUB_RUN_ATTEMPT: "1",
  GITHUB_SHA: "1234567890abcdef",
  GITHUB_REF_NAME: "main",
  GITHUB_SERVER_URL: "https://github.com",
};

const benchmarkReport = {
  benchmark: "workflow-contract-json-roundtrip",
  durationMs: 662.12,
  iterations: 10000,
  operationsPerSecond: 15103,
};

const lighthouseReport = {
  summary: {
    score: 0.95,
    categories: {
      performance: { score: 0.93 },
      accessibility: { score: 1 },
      "best-practices": { score: 0.96 },
      seo: { score: 0.91 },
    },
    metrics: {
      "first-contentful-paint": { numericValue: 1205.8 },
      "largest-contentful-paint": { numericValue: 1355.8 },
      "cumulative-layout-shift": { numericValue: 0 },
      "total-blocking-time": { numericValue: 0 },
      interactive: { numericValue: 1355.8 },
      "max-potential-fid": { numericValue: 16 },
    },
  },
};

describe("build metrics", () => {
  test("parses benchmark and Lighthouse reports into the current build shape", () => {
    const entry = buildMetricsEntryFromReports({
      benchmarkReport,
      buildReport: {
        completedAt: "2026-06-07T12:00:01.200Z",
        durationMs: 1200,
        startedAt: "2026-06-07T12:00:00.000Z",
      },
      bundleReport: {
        budgetBytes: 358400,
        cssBudgetBytes: 122880,
        cssBytes: 45678,
        cssWithinBudget: true,
        jsBytes: 123456,
        withinBudget: true,
      },
      completedAt: "2026-06-07T12:00:00.000Z",
      env,
      lighthouseReport,
    });

    expect(entry.benchmark).toEqual({
      name: "workflow-contract-json-roundtrip",
      durationMs: 662.12,
      iterations: 10000,
      operationsPerSecond: 15103,
    });
    expect(entry.lighthouse.score).toBe(0.95);
    expect(entry.lighthouse.categories.bestPractices).toBe(0.96);
    expect(entry.lighthouse.metrics.largestContentfulPaintMs).toBe(1355.8);
    expect(entry.bundle.withinBudget).toBe(true);
    expect(entry.bundle.cssBytes).toBe(45678);
    expect(entry.startedAt).toBe("2026-06-07T12:00:00.000Z");
    expect(entry.completedAt).toBe("2026-06-07T12:00:01.200Z");
  });

  test("keeps old bundle metrics history entries without CSS fields", () => {
    const build = makeBuild();
    const legacyBuild = {
      ...build,
      bundle: {
        budgetBytes: 358400,
        jsBytes: 123456,
        withinBudget: true,
      },
    };
    const history = normalizeBuildMetricsHistory({ builds: [legacyBuild] });

    expect(history.builds[0].bundle.cssBytes).toBeNull();
    expect(history.builds[0].bundle.cssBudgetBytes).toBeNull();
    expect(history.builds[0].bundle.cssWithinBudget).toBeNull();
  });

  test("uses null Lighthouse fields when the Lighthouse report is missing", () => {
    const entry = buildMetricsEntryFromReports({
      benchmarkReport,
      buildReport: null,
      bundleReport: null,
      completedAt: "2026-06-07T12:00:00.000Z",
      env,
      lighthouseReport: null,
    });

    expect(entry.lighthouse.score).toBeNull();
    expect(entry.lighthouse.categories.performance).toBeNull();
    expect(entry.lighthouse.metrics.cumulativeLayoutShift).toBeNull();
  });

  test("fails when an optional numeric run attempt is invalid", () => {
    expect(() =>
      buildMetricsEntryFromReports({
        benchmarkReport,
        buildReport: { durationMs: 1200 },
        bundleReport: {
          budgetBytes: 358400,
          cssBudgetBytes: 122880,
          cssBytes: 45678,
          cssWithinBudget: true,
          jsBytes: 123456,
          withinBudget: true,
        },
        completedAt: "2026-06-07T12:00:00.000Z",
        env: { ...env, GITHUB_RUN_ATTEMPT: "not-a-number" },
        lighthouseReport,
      }),
    ).toThrow("GITHUB_RUN_ATTEMPT must be numeric.");
  });

  test("filters previous history entries with invalid completion dates", () => {
    const validBuild = makeBuild({ runId: 2, runNumber: 2 });
    const history = normalizeBuildMetricsHistory({
      builds: [makeBuild({ completedAt: "not-a-date", runId: 1, runNumber: 1 }), validBuild],
    });

    expect(history.builds).toEqual([validBuild]);
  });

  test("dedupes run attempts and keeps the newest five builds", () => {
    const builds = Array.from({ length: 6 }, (_, index) =>
      makeBuild({
        runId: index + 1,
        runNumber: index + 1,
        completedAt: `2026-06-07T12:0${index}:00.000Z`,
      }),
    );
    const previousHistory = normalizeBuildMetricsHistory({
      builds: [builds[5], ...builds],
    });

    const nextHistory = mergeBuildMetricsHistory(
      previousHistory,
      makeBuild({
        runId: 7,
        runNumber: 7,
        completedAt: "2026-06-07T12:07:00.000Z",
      }),
      "2026-06-07T12:08:00.000Z",
    );

    expect(nextHistory.builds).toHaveLength(5);
    expect(nextHistory.builds.map((build) => build.runId)).toEqual([7, 6, 5, 4, 3]);
  });

  test("replaces a previous history entry for the same run attempt with the current build", () => {
    const previousHistory = normalizeBuildMetricsHistory({
      builds: [
        makeBuild({
          completedAt: "2026-06-07T12:00:00.000Z",
          durations: { buildMs: 3000 },
          runId: 10,
          runNumber: 10,
        }),
      ],
    });
    const currentBuild = makeBuild({
      completedAt: "2026-06-07T12:10:00.000Z",
      durations: { buildMs: 1200 },
      runId: 10,
      runNumber: 10,
    });

    const nextHistory = mergeBuildMetricsHistory(
      previousHistory,
      currentBuild,
      "2026-06-07T12:11:00.000Z",
    );

    expect(nextHistory.builds).toHaveLength(1);
    expect(nextHistory.builds[0].durations.buildMs).toBe(1200);
  });

  test("rejects an invalid current build completion date", () => {
    const previousHistory = emptyBuildMetricsHistory("2026-06-07T12:00:00.000Z");

    expect(() =>
      mergeBuildMetricsHistory(
        previousHistory,
        makeBuild({ completedAt: "not-a-date" }),
        "2026-06-07T12:11:00.000Z",
      ),
    ).toThrow("Current build completedAt must be a valid date.");
  });

  test("preserves previous history when no current build is available", () => {
    const previousHistory = {
      ...emptyBuildMetricsHistory("2026-06-07T12:00:00.000Z"),
      builds: [makeBuild({ runId: 1, runNumber: 1 })],
    };

    const nextHistory = mergeBuildMetricsHistory(previousHistory, null, "2026-06-07T12:10:00.000Z");

    expect(nextHistory.builds).toEqual(previousHistory.builds);
    expect(nextHistory.generatedAt).toBe("2026-06-07T12:10:00.000Z");
  });

  test("fails on malformed current metrics JSON", () => {
    expect(() => parseJsonObject("{", "current-build.json")).toThrow();
  });
});

function makeBuild(overrides: Partial<BuildMetricsEntry> = {}): BuildMetricsEntry {
  const runId = overrides.runId ?? 1;
  const runAttempt = overrides.runAttempt ?? 1;

  return {
    id: `${runId}-${runAttempt}`,
    runId,
    runNumber: overrides.runNumber ?? runId,
    runAttempt,
    event: "push",
    branch: "main",
    commitSha: "1234567890abcdef",
    commitShortSha: "1234567",
    commitUrl: `https://github.com/moritzbrantner/reusable-workflows/commit/1234567890abcdef`,
    runUrl: `https://github.com/moritzbrantner/reusable-workflows/actions/runs/${runId}/attempts/${runAttempt}`,
    startedAt: overrides.startedAt ?? "2026-06-07T12:00:00.000Z",
    completedAt: overrides.completedAt ?? "2026-06-07T12:00:00.000Z",
    status: "success",
    durations: { buildMs: 1200 },
    bundle: {
      budgetBytes: 358400,
      cssBudgetBytes: 122880,
      cssBytes: 45678,
      cssWithinBudget: true,
      jsBytes: 123456,
      withinBudget: true,
    },
    benchmark: {
      name: "workflow-contract-json-roundtrip",
      durationMs: 662.12,
      iterations: 10000,
      operationsPerSecond: 15103,
    },
    lighthouse: {
      score: 0.95,
      categories: {
        performance: 0.93,
        accessibility: 1,
        bestPractices: 0.96,
        seo: 0.91,
      },
      metrics: {
        firstContentfulPaintMs: 1205.8,
        largestContentfulPaintMs: 1355.8,
        cumulativeLayoutShift: 0,
        totalBlockingTimeMs: 0,
        timeToInteractiveMs: 1355.8,
        maxPotentialFidMs: 16,
      },
    },
    ...overrides,
  };
}
