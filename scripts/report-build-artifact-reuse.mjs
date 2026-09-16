import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const BUILD_STEP = "Build artifact once";
const IDENTITY_STEP = "Define deterministic artifact identity";
const REUSE_STEP = "Verify reusable artifact receipt and coordinates";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function asDate(value, label) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} must be an ISO-8601 timestamp, got ${value}`);
  }
  return date;
}

function durationSeconds(startedAt, completedAt) {
  if (!startedAt || !completedAt) {
    return null;
  }
  const started = new Date(startedAt).getTime();
  const completed = new Date(completedAt).getTime();
  if (!Number.isFinite(started) || !Number.isFinite(completed) || completed < started) {
    return null;
  }
  return (completed - started) / 1000;
}

function median(values) {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function mean(values) {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function stats(values) {
  return {
    sampleSize: values.length,
    meanSeconds: mean(values),
    medianSeconds: median(values),
  };
}

function step(job, name) {
  return (job.steps ?? []).find((candidate) => candidate.name === name);
}

export function classifyBuildArtifactJob(job) {
  if (!step(job, IDENTITY_STEP) || !step(job, BUILD_STEP)) {
    return null;
  }

  const build = step(job, BUILD_STEP);
  const reuse = step(job, REUSE_STEP);
  if (reuse?.conclusion === "success" && build?.conclusion === "skipped") {
    return "hit";
  }
  if (build?.conclusion === "success") {
    return "miss";
  }
  if (["failure", "cancelled", "timed_out"].includes(build?.conclusion)) {
    return "failed";
  }
  return "unclassified";
}

function runnerPlatform(job) {
  const labels = [...(job.labels ?? [])].sort();
  return labels.length > 0 ? labels.join("+") : "unknown-runner";
}

function callerJobIdentity(jobName, collapseCallerPrefix) {
  if (!collapseCallerPrefix) {
    return jobName;
  }
  const segments = jobName.split(" / ");
  return segments.at(-1) ?? jobName;
}

export function observationFromJob({ repo, run, job, collapseCallerPrefix = false }) {
  const reuseOutcome = classifyBuildArtifactJob(job);
  if (reuseOutcome === null) {
    return null;
  }

  const executionSeconds = durationSeconds(job.started_at, job.completed_at);
  const queueSeconds = durationSeconds(job.created_at, job.started_at);
  const workflowName = job.workflow_name ?? run.name ?? "unknown-workflow";
  const jobIdentity = callerJobIdentity(job.name, collapseCallerPrefix);
  const platform = runnerPlatform(job);
  const sourceSha = job.head_sha ?? run.head_sha ?? "unknown-source";
  const exactKey = [repo, workflowName, jobIdentity, sourceSha, platform].join("|");
  const rollingKey = [repo, workflowName, jobIdentity, platform].join("|");

  return {
    repository: repo,
    workflowName,
    jobName: job.name,
    comparisonJobIdentity: jobIdentity,
    sourceSha,
    runnerPlatform: platform,
    runId: run.id,
    runAttempt: job.run_attempt ?? run.run_attempt ?? null,
    jobId: job.id,
    htmlUrl: job.html_url ?? null,
    outcome: job.conclusion ?? null,
    reuseOutcome,
    createdAt: job.created_at ?? null,
    startedAt: job.started_at ?? null,
    completedAt: job.completed_at ?? null,
    queueSeconds,
    executionSeconds,
    exactKey,
    rollingKey,
    comparisonAssumption: collapseCallerPrefix
      ? "caller-job-prefix-collapsed; verify caller jobs share the same build identity"
      : "strict repository/workflow/job/source/runner identity",
  };
}

function summarizeExactGroup(group) {
  const hits = group.filter(
    (observation) => observation.reuseOutcome === "hit" && observation.executionSeconds !== null,
  );
  const misses = group.filter(
    (observation) => observation.reuseOutcome === "miss" && observation.executionSeconds !== null,
  );
  const hitDurations = hits.map((observation) => observation.executionSeconds);
  const missDurations = misses.map((observation) => observation.executionSeconds);
  const hitQueue = hits
    .map((observation) => observation.queueSeconds)
    .filter((value) => value !== null);
  const missQueue = misses
    .map((observation) => observation.queueSeconds)
    .filter((value) => value !== null);
  const baseline = median(missDurations);
  const estimatedSavings = baseline === null ? [] : hitDurations.map((duration) => baseline - duration);
  const hitMean = mean(hitDurations);
  const speedupPercent =
    baseline === null || hitMean === null || baseline === 0
      ? null
      : ((baseline - hitMean) / baseline) * 100;

  const representative = group[0];
  return {
    repository: representative.repository,
    workflowName: representative.workflowName,
    comparisonJobIdentity: representative.comparisonJobIdentity,
    sourceSha: representative.sourceSha,
    runnerPlatform: representative.runnerPlatform,
    comparisonAssumption: representative.comparisonAssumption,
    sampleSize: group.length,
    hitCount: hits.length,
    missCount: misses.length,
    failedOrUnclassifiedCount: group.length - hits.length - misses.length,
    hitRate: group.length === 0 ? null : hits.length / group.length,
    execution: {
      hits: stats(hitDurations),
      misses: stats(missDurations),
    },
    queue: {
      hits: stats(hitQueue),
      misses: stats(missQueue),
      missingSamples: hits.length + misses.length - hitQueue.length - missQueue.length,
    },
    measured: {
      observedHitExecutionSeconds: hitDurations,
      observedMissExecutionSeconds: missDurations,
    },
    estimated: {
      baselineKind: baseline === null ? null : "median observed miss for the exact comparison group",
      baselineExecutionSeconds: baseline,
      meanSecondsSavedPerHit: mean(estimatedSavings),
      medianSecondsSavedPerHit: median(estimatedSavings),
      totalSecondsSaved:
        estimatedSavings.length === 0 ? null : estimatedSavings.reduce((a, b) => a + b, 0),
      speedupPercent,
    },
    flags: [
      ...(hits.length < 2 || misses.length < 2 ? ["small-sample"] : []),
      ...(representative.comparisonAssumption.startsWith("caller-job-prefix-collapsed")
        ? ["caller-equivalence-assumed"]
        : []),
    ],
  };
}

function fixedWeekIndex(timestamp, until) {
  const time = new Date(timestamp).getTime();
  const end = until.getTime();
  if (!Number.isFinite(time) || time > end) {
    return null;
  }
  return Math.floor((end - time) / WEEK_MS);
}

function summarizeRollingGroup(group, until, rollingWeeks) {
  const buckets = Array.from({ length: rollingWeeks }, (_, index) => ({
    index,
    hits: [],
    misses: [],
  }));
  for (const observation of group) {
    if (observation.executionSeconds === null || !observation.startedAt) {
      continue;
    }
    const index = fixedWeekIndex(observation.startedAt, until);
    if (index === null || index < 0 || index >= rollingWeeks) {
      continue;
    }
    if (observation.reuseOutcome === "hit") {
      buckets[index].hits.push(observation.executionSeconds);
    } else if (observation.reuseOutcome === "miss") {
      buckets[index].misses.push(observation.executionSeconds);
    }
  }

  const weekly = buckets.map((bucket) => {
    const end = new Date(until.getTime() - bucket.index * WEEK_MS);
    const start = new Date(end.getTime() - WEEK_MS);
    return {
      weekIndex: bucket.index,
      start: start.toISOString(),
      end: end.toISOString(),
      hits: stats(bucket.hits),
      misses: stats(bucket.misses),
    };
  });

  const weeklyHitMeans = weekly
    .map((bucket) => bucket.hits.meanSeconds)
    .filter((value) => value !== null);
  const weeklyMissMeans = weekly
    .map((bucket) => bucket.misses.meanSeconds)
    .filter((value) => value !== null);
  const representative = group[0];
  return {
    repository: representative.repository,
    workflowName: representative.workflowName,
    comparisonJobIdentity: representative.comparisonJobIdentity,
    runnerPlatform: representative.runnerPlatform,
    sourceIdentity: "varies across weeks; compare only as a same-job/same-runner trend",
    weekly,
    rolling: {
      weeksWithHitSamples: weeklyHitMeans.length,
      weeksWithMissSamples: weeklyMissMeans.length,
      meanOfWeeklyHitMeanExecutionSeconds:
        weeklyHitMeans.length >= 2 ? mean(weeklyHitMeans) : null,
      meanOfWeeklyMissMeanExecutionSeconds:
        weeklyMissMeans.length >= 2 ? mean(weeklyMissMeans) : null,
    },
    flags: [
      ...(weeklyHitMeans.length < 2 && weeklyMissMeans.length < 2
        ? ["insufficient-multi-week-data"]
        : []),
      "source-varies-across-weeks",
    ],
  };
}

function groupBy(observations, keySelector) {
  const groups = new Map();
  for (const observation of observations) {
    const key = keySelector(observation);
    const group = groups.get(key) ?? [];
    group.push(observation);
    groups.set(key, group);
  }
  return groups;
}

export function buildReport({ observations, since, until, rollingWeeks }) {
  const exactGroups = [...groupBy(observations, (observation) => observation.exactKey).values()];
  const rollingGroups = [...groupBy(observations, (observation) => observation.rollingKey).values()];
  const comparisons = exactGroups
    .map(summarizeExactGroup)
    .filter((group) => group.hitCount > 0 || group.missCount > 0);
  const rolling = rollingGroups.map((group) => summarizeRollingGroup(group, until, rollingWeeks));
  const currentWindow = observations.filter((observation) => {
    if (!observation.startedAt) {
      return false;
    }
    const started = new Date(observation.startedAt);
    return started >= since && started <= until;
  });

  return {
    schemaVersion: 1,
    kind: "reusable-workflows/build-artifact-reuse-report",
    generatedAt: new Date().toISOString(),
    window: {
      since: since.toISOString(),
      until: until.toISOString(),
      rollingWeeks,
    },
    currentWindow: {
      sampleSize: currentWindow.length,
      hitCount: currentWindow.filter((item) => item.reuseOutcome === "hit").length,
      missCount: currentWindow.filter((item) => item.reuseOutcome === "miss").length,
      failedOrUnclassifiedCount: currentWindow.filter(
        (item) => !["hit", "miss"].includes(item.reuseOutcome),
      ).length,
    },
    observations,
    exactComparisons: comparisons,
    rollingComparisons: rolling,
    caveats: [
      "Execution duration is job started_at to completed_at; queue delay is job created_at to started_at when GitHub exposes created_at.",
      "Savings are counterfactual estimates derived from observed miss baselines; raw hit and miss durations are measured.",
      "Exact comparisons require repository, workflow/job identity, source SHA, and runner platform to match.",
      "Rolling comparisons intentionally allow source SHA to vary and are therefore weaker evidence than exact comparisons.",
    ],
  };
}

function parseArgs(argv) {
  const options = {
    repos: [],
    since: null,
    until: new Date(),
    rollingWeeks: 4,
    collapseCallerPrefix: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--repo") {
      options.repos.push(argv[++index]);
    } else if (arg === "--since") {
      options.since = asDate(argv[++index], "--since");
    } else if (arg === "--until") {
      options.until = asDate(argv[++index], "--until");
    } else if (arg === "--rolling-weeks") {
      options.rollingWeeks = Number.parseInt(argv[++index], 10);
    } else if (arg === "--collapse-caller-job-prefix") {
      options.collapseCallerPrefix = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (!Number.isInteger(options.rollingWeeks) || options.rollingWeeks < 1) {
    throw new Error("--rolling-weeks must be a positive integer");
  }
  options.since ??= new Date(options.until.getTime() - WEEK_MS);
  if (options.since > options.until) {
    throw new Error("--since must not be after --until");
  }
  return options;
}

function ghJson(args) {
  const result = spawnSync("gh", ["api", ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `gh api exited with ${result.status}`);
  }
  return JSON.parse(result.stdout);
}

function flattenPages(payload, key) {
  const pages = Array.isArray(payload) ? payload : [payload];
  return pages.flatMap((page) => page[key] ?? []);
}

function listRuns(repo, fetchSince) {
  const payload = ghJson([
    "--paginate",
    "--slurp",
    "-X",
    "GET",
    `repos/${repo}/actions/runs`,
    "-f",
    "per_page=100",
    "-f",
    `created=>=${fetchSince.toISOString()}`,
  ]);
  return flattenPages(payload, "workflow_runs");
}

function listJobs(repo, runId) {
  const payload = ghJson([
    "--paginate",
    "--slurp",
    `repos/${repo}/actions/runs/${runId}/jobs?per_page=100&filter=all`,
  ]);
  return flattenPages(payload, "jobs");
}

async function collectObservations(options) {
  const fetchSince = new Date(
    Math.min(options.since.getTime(), options.until.getTime() - options.rollingWeeks * WEEK_MS),
  );
  const observations = [];
  for (const repo of options.repos) {
    const runs = listRuns(repo, fetchSince).filter((run) => {
      const created = new Date(run.created_at);
      return created >= fetchSince && created <= options.until;
    });
    for (const run of runs) {
      for (const job of listJobs(repo, run.id)) {
        const observation = observationFromJob({
          repo,
          run,
          job,
          collapseCallerPrefix: options.collapseCallerPrefix,
        });
        if (observation) {
          observations.push(observation);
        }
      }
    }
  }
  return observations;
}

function usage() {
  return `Usage: bun scripts/report-build-artifact-reuse.mjs --repo OWNER/REPO [--repo OWNER/REPO ...]\n\nOptions:\n  --since ISO                 Current reporting-window start (default: seven days before --until)\n  --until ISO                 Reporting-window end (default: now)\n  --rolling-weeks N           Number of seven-day buckets to inspect (default: 4)\n  --collapse-caller-job-prefix\n                              Compare nested Build Artifact jobs across caller job names.\n                              Use only when those callers are known to share one build identity.\n`;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (options.repos.length === 0) {
    throw new Error("at least one --repo OWNER/REPO is required");
  }
  const observations = await collectObservations(options);
  const report = buildReport({
    observations,
    since: options.since,
    until: options.until,
    rollingWeeks: options.rollingWeeks,
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
