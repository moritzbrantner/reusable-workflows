import type { BuildMetricsHistory } from "../build-metrics";
import buildMetricsHistoryJson from "../generated/build-metrics-history.json";
import {
  formatBytes,
  formatDateTime,
  formatDuration,
  formatOps,
  formatScoreValue,
} from "./formatters";
import type { MetricsChartDatum, MetricsChartSeriesId } from "./types";

export const metricsChartSeries: Array<{
  color: string;
  description: string;
  direction: "higher-is-better" | "lower-is-better";
  id: MetricsChartSeriesId;
  interpretation: string;
  label: string;
  normalization: string;
  source: string;
}> = [
  {
    color: "#166534",
    description:
      "Elapsed wall-clock time for the measured `bun run build` command captured during the performance validation job.",
    direction: "lower-is-better",
    id: "build",
    interpretation: "Lower values mean the reference app can be rebuilt and deployed faster.",
    label: "Build duration",
    normalization: "Health index = oldest visible build duration / run build duration * 100.",
    source: "performance-results/build.json",
  },
  {
    color: "#2563eb",
    description:
      "Total JavaScript bytes emitted into `dist/`, compared with the repository's 420 KiB budget.",
    direction: "lower-is-better",
    id: "bundle",
    interpretation:
      "Lower values reduce the amount of script shipped by the published reference app.",
    label: "JS bundle",
    normalization: "Health index = oldest visible JavaScript bytes / run JavaScript bytes * 100.",
    source: "performance-results/bundle-size.json",
  },
  {
    color: "#c2410c",
    description:
      "Median throughput from repeated Contract Manifest JSON roundtrip benchmark samples.",
    direction: "higher-is-better",
    id: "benchmark",
    interpretation: "Higher values mean the contract data can be serialized and parsed faster.",
    label: "Benchmark ops/s",
    normalization:
      "Health index = run operations per second / oldest visible operations per second * 100.",
    source: "benchmark-results/workflow-contracts.json",
  },
  {
    color: "#7c3aed",
    description:
      "Overall Lighthouse score collected from the built and previewed site during performance validation.",
    direction: "higher-is-better",
    id: "lighthouse",
    interpretation:
      "Higher values mean the published reference page keeps stronger page quality signals.",
    label: "Lighthouse score",
    normalization: "Health index = run Lighthouse score / oldest visible Lighthouse score * 100.",
    source: ".unlighthouse/ci-result.json",
  },
];

declare global {
  interface Window {
    buildMetricsHistoryFixture?: BuildMetricsHistory;
  }
}

export const buildMetricsHistory = getBuildMetricsHistory();

function getBuildMetricsHistory(): BuildMetricsHistory {
  if (typeof window !== "undefined" && window.buildMetricsHistoryFixture) {
    return window.buildMetricsHistoryFixture;
  }

  return buildMetricsHistoryJson as BuildMetricsHistory;
}

export function createMetricsChartRows(builds: BuildMetricsHistory["builds"]): MetricsChartDatum[] {
  const chronologicalBuilds = [...builds].reverse();
  const references = Object.fromEntries(
    metricsChartSeries.map((series) => [
      series.id,
      referenceMetricValue(chronologicalBuilds, series.id),
    ]),
  ) as Record<MetricsChartSeriesId, number | null>;

  return chronologicalBuilds.map((build) => {
    const row: MetricsChartDatum = {
      completedLabel: formatDateTime(build.completedAt),
      raw: {} as Record<MetricsChartSeriesId, string>,
      runLabel: `#${build.runNumber}`,
    };

    for (const series of metricsChartSeries) {
      row.raw[series.id] = formatMetricRawValue(build, series.id);

      const normalizedValue = normalizeMetric(
        readMetricValue(build, series.id),
        references[series.id],
        series.direction,
      );

      if (normalizedValue !== undefined) {
        row[series.id] = normalizedValue;
      }
    }

    return row;
  });
}

function referenceMetricValue(
  builds: BuildMetricsHistory["builds"],
  seriesId: MetricsChartSeriesId,
) {
  for (const build of builds) {
    const value = readMetricValue(build, seriesId);

    if (value !== null && Number.isFinite(value) && value !== 0) {
      return value;
    }
  }

  return null;
}

function readMetricValue(
  build: BuildMetricsHistory["builds"][number],
  seriesId: MetricsChartSeriesId,
) {
  switch (seriesId) {
    case "benchmark":
      return build.benchmark.operationsPerSecond;
    case "build":
      return build.durations.buildMs;
    case "bundle":
      return build.bundle.jsBytes;
    case "lighthouse":
      return build.lighthouse.score;
  }
}

export function formatMetricRawValue(
  build: BuildMetricsHistory["builds"][number],
  seriesId: MetricsChartSeriesId,
) {
  switch (seriesId) {
    case "benchmark":
      return formatOps(build.benchmark.operationsPerSecond);
    case "build":
      return formatDuration(build.durations.buildMs);
    case "bundle":
      return formatBytes(build.bundle.jsBytes);
    case "lighthouse":
      return formatScoreValue(build.lighthouse.score);
  }
}

function normalizeMetric(
  value: number | null,
  referenceValue: number | null,
  direction: "higher-is-better" | "lower-is-better",
) {
  if (value === null || value === 0) {
    return undefined;
  }

  if (referenceValue === null || referenceValue === 0) {
    return undefined;
  }

  const ratio = direction === "lower-is-better" ? referenceValue / value : value / referenceValue;

  return Math.round(ratio * 1000) / 10;
}
