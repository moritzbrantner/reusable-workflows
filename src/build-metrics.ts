export type BuildMetricsHistory = {
  schemaVersion: 1;
  generatedAt: string | null;
  source: "github-actions";
  limit: number;
  builds: BuildMetricsEntry[];
};

export type BuildMetricsEntry = {
  id: string;
  runId: number;
  runNumber: number;
  runAttempt: number;
  event: "push";
  branch: string;
  commitSha: string;
  commitShortSha: string;
  commitUrl: string;
  runUrl: string;
  startedAt: string;
  completedAt: string;
  status: "success";
  durations: {
    buildMs: number | null;
  };
  bundle: {
    jsBytes: number | null;
    budgetBytes: number | null;
    withinBudget: boolean | null;
  };
  benchmark: {
    name: string | null;
    iterations: number | null;
    durationMs: number | null;
    operationsPerSecond: number | null;
  };
  lighthouse: {
    score: number | null;
    categories: {
      performance: number | null;
      accessibility: number | null;
      bestPractices: number | null;
      seo: number | null;
    };
    metrics: {
      firstContentfulPaintMs: number | null;
      largestContentfulPaintMs: number | null;
      cumulativeLayoutShift: number | null;
      totalBlockingTimeMs: number | null;
      timeToInteractiveMs: number | null;
      maxPotentialFidMs: number | null;
    };
  };
};

type JsonRecord = Record<string, unknown>;

export const metricsHistoryLimit = 5;

export function emptyBuildMetricsHistory(generatedAt: string | null = null): BuildMetricsHistory {
  return {
    schemaVersion: 1,
    generatedAt,
    source: "github-actions",
    limit: metricsHistoryLimit,
    builds: [],
  };
}

export function parseJsonObject(value: string, source: string): JsonRecord {
  const parsed = JSON.parse(value) as unknown;

  if (!isRecord(parsed)) {
    throw new Error(`${source} must contain a JSON object.`);
  }

  return parsed;
}

export function normalizeBuildMetricsHistory(
  value: unknown,
  generatedAt: string | null = null,
): BuildMetricsHistory {
  if (!isRecord(value)) {
    return emptyBuildMetricsHistory(generatedAt);
  }

  const builds = Array.isArray(value.builds)
    ? value.builds
        .map(normalizeBuildMetricsEntry)
        .filter(isBuildMetricsEntry)
        .filter((build) => isValidDateString(build.completedAt))
    : [];

  return {
    schemaVersion: 1,
    generatedAt: typeof value.generatedAt === "string" ? value.generatedAt : generatedAt,
    source: "github-actions",
    limit: metricsHistoryLimit,
    builds,
  };
}

export function mergeBuildMetricsHistory(
  previousHistory: BuildMetricsHistory,
  currentBuild: BuildMetricsEntry | null,
  generatedAt: string,
): BuildMetricsHistory {
  if (currentBuild && !isValidDateString(currentBuild.completedAt)) {
    throw new Error("Current build completedAt must be a valid date.");
  }

  const builds = currentBuild ? [currentBuild, ...previousHistory.builds] : previousHistory.builds;
  const deduped = new Map<string, BuildMetricsEntry>();

  for (const build of builds) {
    if (!isValidDateString(build.completedAt)) {
      continue;
    }

    const key = `${build.runId}-${build.runAttempt}`;

    if (!deduped.has(key)) {
      deduped.set(key, build);
    }
  }

  return {
    schemaVersion: 1,
    generatedAt,
    source: "github-actions",
    limit: metricsHistoryLimit,
    builds: [...deduped.values()]
      .sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt))
      .slice(0, metricsHistoryLimit),
  };
}

export function buildMetricsEntryFromReports({
  benchmarkReport,
  buildReport,
  bundleReport,
  completedAt,
  env,
  lighthouseReport,
}: {
  benchmarkReport: unknown;
  buildReport: unknown;
  bundleReport: unknown;
  completedAt: string;
  env: Record<string, string | undefined>;
  lighthouseReport: unknown;
}): BuildMetricsEntry {
  const repository = requiredEnv(env, "GITHUB_REPOSITORY");
  const serverUrl = env.GITHUB_SERVER_URL ?? "https://github.com";
  const runId = requiredNumberEnv(env, "GITHUB_RUN_ID");
  const runNumber = requiredNumberEnv(env, "GITHUB_RUN_NUMBER");
  const runAttempt = optionalNumberEnv(env, "GITHUB_RUN_ATTEMPT", 1);
  const commitSha = requiredEnv(env, "GITHUB_SHA");
  const branch = normalizeBranch(env.GITHUB_REF_NAME ?? env.GITHUB_REF ?? "");
  const startedAt = env.BUILD_METRICS_STARTED_AT ?? completedAt;

  return {
    id: `${runId}-${runAttempt}`,
    runId,
    runNumber,
    runAttempt,
    event: "push",
    branch,
    commitSha,
    commitShortSha: commitSha.slice(0, 7),
    commitUrl: `${serverUrl}/${repository}/commit/${commitSha}`,
    runUrl: `${serverUrl}/${repository}/actions/runs/${runId}/attempts/${runAttempt}`,
    startedAt,
    completedAt,
    status: "success",
    durations: {
      buildMs: readNumber(buildReport, ["durationMs"]),
    },
    bundle: {
      jsBytes: readNumber(bundleReport, ["jsBytes"]),
      budgetBytes: readNumber(bundleReport, ["budgetBytes"]),
      withinBudget: readBoolean(bundleReport, ["withinBudget"]),
    },
    benchmark: {
      name: readString(benchmarkReport, ["benchmark"]),
      iterations: readNumber(benchmarkReport, ["iterations"]),
      durationMs: readNumber(benchmarkReport, ["durationMs"]),
      operationsPerSecond: readNumber(benchmarkReport, ["operationsPerSecond"]),
    },
    lighthouse: normalizeLighthouseMetrics(lighthouseReport),
  };
}

export function buildMetricsMarkdown(entry: BuildMetricsEntry): string {
  return [
    "# Build Metrics",
    "",
    `- Run: [#${entry.runNumber}](${entry.runUrl})`,
    `- Commit: [${entry.commitShortSha}](${entry.commitUrl})`,
    `- Build duration: ${formatNullable(entry.durations.buildMs, " ms")}`,
    `- JavaScript bundle: ${formatNullable(entry.bundle.jsBytes, " bytes")}`,
    `- Benchmark throughput: ${formatNullable(entry.benchmark.operationsPerSecond, " ops/s")}`,
    `- Lighthouse score: ${formatScore(entry.lighthouse.score)}`,
    "",
  ].join("\n");
}

function normalizeBuildMetricsEntry(value: unknown): unknown {
  if (!isRecord(value)) {
    return null;
  }

  return {
    id:
      readString(value, ["id"]) ??
      `${readNumber(value, ["runId"]) ?? 0}-${readNumber(value, ["runAttempt"]) ?? 1}`,
    runId: readNumber(value, ["runId"]),
    runNumber: readNumber(value, ["runNumber"]),
    runAttempt: readNumber(value, ["runAttempt"]) ?? 1,
    event: "push",
    branch: readString(value, ["branch"]),
    commitSha: readString(value, ["commitSha"]),
    commitShortSha: readString(value, ["commitShortSha"]),
    commitUrl: readString(value, ["commitUrl"]),
    runUrl: readString(value, ["runUrl"]),
    startedAt: readString(value, ["startedAt"]),
    completedAt: readString(value, ["completedAt"]),
    status: "success",
    durations: {
      buildMs: readNumber(value, ["durations", "buildMs"]),
    },
    bundle: {
      jsBytes: readNumber(value, ["bundle", "jsBytes"]),
      budgetBytes: readNumber(value, ["bundle", "budgetBytes"]),
      withinBudget: readBoolean(value, ["bundle", "withinBudget"]),
    },
    benchmark: {
      name: readString(value, ["benchmark", "name"]),
      iterations: readNumber(value, ["benchmark", "iterations"]),
      durationMs: readNumber(value, ["benchmark", "durationMs"]),
      operationsPerSecond: readNumber(value, ["benchmark", "operationsPerSecond"]),
    },
    lighthouse: {
      score: readNumber(value, ["lighthouse", "score"]),
      categories: {
        performance: readNumber(value, ["lighthouse", "categories", "performance"]),
        accessibility: readNumber(value, ["lighthouse", "categories", "accessibility"]),
        bestPractices: readNumber(value, ["lighthouse", "categories", "bestPractices"]),
        seo: readNumber(value, ["lighthouse", "categories", "seo"]),
      },
      metrics: {
        firstContentfulPaintMs: readNumber(value, [
          "lighthouse",
          "metrics",
          "firstContentfulPaintMs",
        ]),
        largestContentfulPaintMs: readNumber(value, [
          "lighthouse",
          "metrics",
          "largestContentfulPaintMs",
        ]),
        cumulativeLayoutShift: readNumber(value, [
          "lighthouse",
          "metrics",
          "cumulativeLayoutShift",
        ]),
        totalBlockingTimeMs: readNumber(value, ["lighthouse", "metrics", "totalBlockingTimeMs"]),
        timeToInteractiveMs: readNumber(value, ["lighthouse", "metrics", "timeToInteractiveMs"]),
        maxPotentialFidMs: readNumber(value, ["lighthouse", "metrics", "maxPotentialFidMs"]),
      },
    },
  };
}

function isBuildMetricsEntry(value: unknown): value is BuildMetricsEntry {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.runId === "number" &&
    typeof value.runNumber === "number" &&
    typeof value.runAttempt === "number" &&
    typeof value.branch === "string" &&
    typeof value.commitSha === "string" &&
    typeof value.commitShortSha === "string" &&
    typeof value.commitUrl === "string" &&
    typeof value.runUrl === "string" &&
    typeof value.startedAt === "string" &&
    typeof value.completedAt === "string" &&
    isRecord(value.durations) &&
    isRecord(value.bundle) &&
    isRecord(value.benchmark) &&
    isRecord(value.lighthouse)
  );
}

function normalizeLighthouseMetrics(value: unknown): BuildMetricsEntry["lighthouse"] {
  return {
    score: readNumber(value, ["summary", "score"]),
    categories: {
      performance: readNumber(value, ["summary", "categories", "performance", "score"]),
      accessibility: readNumber(value, ["summary", "categories", "accessibility", "score"]),
      bestPractices: readNumber(value, ["summary", "categories", "best-practices", "score"]),
      seo: readNumber(value, ["summary", "categories", "seo", "score"]),
    },
    metrics: {
      firstContentfulPaintMs: readNumber(value, [
        "summary",
        "metrics",
        "first-contentful-paint",
        "numericValue",
      ]),
      largestContentfulPaintMs: readNumber(value, [
        "summary",
        "metrics",
        "largest-contentful-paint",
        "numericValue",
      ]),
      cumulativeLayoutShift: readNumber(value, [
        "summary",
        "metrics",
        "cumulative-layout-shift",
        "numericValue",
      ]),
      totalBlockingTimeMs: readNumber(value, [
        "summary",
        "metrics",
        "total-blocking-time",
        "numericValue",
      ]),
      timeToInteractiveMs: readNumber(value, ["summary", "metrics", "interactive", "numericValue"]),
      maxPotentialFidMs: readNumber(value, [
        "summary",
        "metrics",
        "max-potential-fid",
        "numericValue",
      ]),
    },
  };
}

function readNumber(value: unknown, path: string[]): number | null {
  const found = readPath(value, path);

  return typeof found === "number" && Number.isFinite(found) ? found : null;
}

function readString(value: unknown, path: string[]): string | null {
  const found = readPath(value, path);

  return typeof found === "string" ? found : null;
}

function readBoolean(value: unknown, path: string[]): boolean | null {
  const found = readPath(value, path);

  return typeof found === "boolean" ? found : null;
}

function readPath(value: unknown, path: string[]): unknown {
  return path.reduce<unknown>(
    (current, key) => (isRecord(current) ? current[key] : undefined),
    value,
  );
}

function requiredEnv(env: Record<string, string | undefined>, key: string): string {
  const value = env[key];

  if (!value) {
    throw new Error(`${key} is required to write build metrics.`);
  }

  return value;
}

function requiredNumberEnv(env: Record<string, string | undefined>, key: string): number {
  const value = Number(requiredEnv(env, key));

  if (!Number.isFinite(value)) {
    throw new Error(`${key} must be numeric.`);
  }

  return value;
}

function optionalNumberEnv(
  env: Record<string, string | undefined>,
  key: string,
  defaultValue: number,
): number {
  const rawValue = env[key];

  if (rawValue === undefined || rawValue === "") {
    return defaultValue;
  }

  const value = Number(rawValue);

  if (!Number.isFinite(value)) {
    throw new Error(`${key} must be numeric.`);
  }

  return value;
}

function normalizeBranch(ref: string): string {
  return ref.replace(/^refs\/heads\//, "") || "main";
}

function formatNullable(value: number | null, unit: string): string {
  return value === null ? "not available" : `${Math.round(value).toLocaleString("en-US")}${unit}`;
}

function formatScore(value: number | null): string {
  return value === null ? "not available" : `${Math.round(value * 100)}%`;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidDateString(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}
