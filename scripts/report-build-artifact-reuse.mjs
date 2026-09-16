import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const IDENTITY_STEP = "Define deterministic artifact identity";
const REUSE_CANDIDATE_STEP = "Find reusable artifact receipt";
const REUSE_STEP = "Verify reusable artifact receipt and coordinates";
const BUILD_STEP = "Build artifact once";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function asDate(value, label) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be an ISO-8601 timestamp`);
  return date;
}

function durationSeconds(start, end) {
  if (!start || !end) return null;
  const value = (new Date(end).getTime() - new Date(start).getTime()) / 1000;
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function stats(values) {
  return { sampleSize: values.length, meanSeconds: mean(values), medianSeconds: median(values) };
}

function step(job, name) {
  return (job.steps ?? []).find((candidate) => candidate.name === name);
}

export function classifyBuildArtifactJob(job) {
  if (!step(job, IDENTITY_STEP) || !step(job, BUILD_STEP)) return null;
  const lookup = step(job, REUSE_CANDIDATE_STEP);
  if (!lookup || lookup.conclusion === "skipped") return null;

  const reuse = step(job, REUSE_STEP);
  const build = step(job, BUILD_STEP);
  if (reuse?.conclusion === "success" && build?.conclusion === "skipped") return "hit";
  if (build?.conclusion === "success") return "miss";
  if (["failure", "cancelled", "timed_out"].includes(build?.conclusion)) return "failed";
  return "unclassified";
}

function normalizedLogLines(logs) {
  return logs.split(/\r?\n/).map((line) =>
    line
      .replace(/^\uFEFF/, "")
      .replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\s+/, ""),
  );
}

function environmentValue(lines, key, pattern) {
  const prefix = `${key}:`;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith(prefix)) continue;
    const value = trimmed.slice(prefix.length).trim();
    if (pattern.test(value)) return value;
  }
  return null;
}

export function parseBuildArtifactContract(logs) {
  const lines = normalizedLogLines(logs);
  let inputs = {};
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].trim() !== "##[group] Inputs") continue;
    const candidate = {};
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (lines[cursor].trim() === "##[endgroup]") break;
      const match = lines[cursor].match(/^\s*([a-zA-Z0-9_]+):\s*(.*)$/);
      if (match) candidate[match[1]] = match[2];
    }
    if (candidate.source_sha || candidate.artifact_key || candidate.reuse_across_runs) {
      inputs = candidate;
      break;
    }
  }

  const sourceSha =
    inputs.source_sha?.match(/^[0-9a-fA-F]{40}$/)?.[0] ??
    environmentValue(lines, "SOURCE_SHA", /^[0-9a-fA-F]{40}$/);
  const artifactKey =
    inputs.artifact_key?.trim() || environmentValue(lines, "ARTIFACT_KEY", /.+/);
  const identityDigest = environmentValue(
    lines,
    "IDENTITY_DIGEST",
    /^sha256:[0-9a-fA-F]{64}$/,
  );

  return {
    sourceSha: sourceSha?.toLowerCase() ?? null,
    artifactKey: artifactKey || null,
    identityDigest: identityDigest?.toLowerCase() ?? null,
    reuseAcrossRuns:
      inputs.reuse_across_runs === "true"
        ? true
        : inputs.reuse_across_runs === "false"
          ? false
          : null,
  };
}

function jobIdentity(name, collapseCallerPrefix) {
  if (!collapseCallerPrefix) return name;
  return name.split(" / ").at(-1) ?? name;
}

export function observationFromJob({ repo, run, job, contract, collapseCallerPrefix = false }) {
  const reuseOutcome = classifyBuildArtifactJob(job);
  if (!reuseOutcome || !contract?.sourceSha || !contract?.artifactKey || !contract?.identityDigest) {
    return null;
  }
  const workflowName = job.workflow_name ?? run.name ?? "unknown-workflow";
  const comparisonJobIdentity = jobIdentity(job.name, collapseCallerPrefix);
  const runnerPlatform = [...(job.labels ?? [])].sort().join("+") || "unknown-runner";
  const exactKey = [
    repo,
    workflowName,
    comparisonJobIdentity,
    contract.sourceSha,
    contract.identityDigest,
    runnerPlatform,
  ].join("|");
  const rollingKey = [
    repo,
    workflowName,
    comparisonJobIdentity,
    contract.artifactKey,
    runnerPlatform,
  ].join("|");

  return {
    repository: repo,
    workflowName,
    jobName: job.name,
    comparisonJobIdentity,
    sourceSha: contract.sourceSha,
    artifactKey: contract.artifactKey,
    buildIdentityDigest: contract.identityDigest,
    runnerPlatform,
    runId: run.id,
    runAttempt: job.run_attempt ?? run.run_attempt ?? null,
    jobId: job.id,
    htmlUrl: job.html_url ?? null,
    reuseOutcome,
    createdAt: job.created_at ?? null,
    startedAt: job.started_at ?? null,
    completedAt: job.completed_at ?? null,
    queueSeconds: durationSeconds(job.created_at, job.started_at),
    executionSeconds: durationSeconds(job.started_at, job.completed_at),
    exactKey,
    rollingKey,
    comparisonAssumption: collapseCallerPrefix
      ? "caller prefix collapsed; exact source/build identity still required"
      : "strict repository/workflow/job/source/build-identity/runner identity",
  };
}

function groupBy(values, key) {
  const groups = new Map();
  for (const value of values) {
    const id = key(value);
    groups.set(id, [...(groups.get(id) ?? []), value]);
  }
  return [...groups.values()];
}

function exactComparison(group) {
  const timedHits = group.filter(
    (item) => item.reuseOutcome === "hit" && item.executionSeconds !== null,
  );
  const timedMisses = group.filter(
    (item) => item.reuseOutcome === "miss" && item.executionSeconds !== null,
  );
  const hitExecution = timedHits.map((item) => item.executionSeconds);
  const missExecution = timedMisses.map((item) => item.executionSeconds);
  const hitQueue = timedHits.map((item) => item.queueSeconds).filter((value) => value !== null);
  const missQueue = timedMisses.map((item) => item.queueSeconds).filter((value) => value !== null);
  const baseline = median(missExecution);
  const savings = baseline === null ? [] : hitExecution.map((duration) => baseline - duration);
  const hitMean = mean(hitExecution);
  const representative = group[0];
  const eligibleSampleSize = timedHits.length + timedMisses.length;

  return {
    repository: representative.repository,
    workflowName: representative.workflowName,
    comparisonJobIdentity: representative.comparisonJobIdentity,
    sourceSha: representative.sourceSha,
    artifactKey: representative.artifactKey,
    buildIdentityDigest: representative.buildIdentityDigest,
    runnerPlatform: representative.runnerPlatform,
    comparisonAssumption: representative.comparisonAssumption,
    sampleSize: group.length,
    eligibleSampleSize,
    hitCount: timedHits.length,
    missCount: timedMisses.length,
    failedOrUntimedCount: group.length - eligibleSampleSize,
    hitRate: eligibleSampleSize ? timedHits.length / eligibleSampleSize : null,
    execution: { hits: stats(hitExecution), misses: stats(missExecution) },
    queue: {
      hits: stats(hitQueue),
      misses: stats(missQueue),
      missingSamples: eligibleSampleSize - hitQueue.length - missQueue.length,
    },
    measured: {
      observedHitExecutionSeconds: hitExecution,
      observedMissExecutionSeconds: missExecution,
    },
    estimated: {
      baselineKind:
        baseline === null ? null : "median observed miss for this exact comparison group",
      baselineExecutionSeconds: baseline,
      meanSecondsSavedPerHit: mean(savings),
      medianSecondsSavedPerHit: median(savings),
      totalSecondsSaved: savings.length ? savings.reduce((sum, value) => sum + value, 0) : null,
      speedupPercent:
        baseline && hitMean !== null ? ((baseline - hitMean) / baseline) * 100 : null,
    },
    flags: [
      ...(timedHits.length < 2 || timedMisses.length < 2 ? ["small-sample"] : []),
      ...(representative.comparisonAssumption.startsWith("caller prefix collapsed")
        ? ["caller-equivalence-assumed"]
        : []),
    ],
  };
}

function rollingComparison(group, until, rollingWeeks) {
  const buckets = Array.from({ length: rollingWeeks }, () => ({ hits: [], misses: [] }));
  for (const item of group) {
    if (!item.startedAt || item.executionSeconds === null) continue;
    const index = Math.floor(
      (until.getTime() - new Date(item.startedAt).getTime()) / WEEK_MS,
    );
    if (index < 0 || index >= rollingWeeks) continue;
    if (item.reuseOutcome === "hit") buckets[index].hits.push(item.executionSeconds);
    if (item.reuseOutcome === "miss") buckets[index].misses.push(item.executionSeconds);
  }
  const weekly = buckets.map((bucket, weekIndex) => {
    const end = new Date(until.getTime() - weekIndex * WEEK_MS);
    const start = new Date(end.getTime() - WEEK_MS);
    const eligible = [...bucket.hits, ...bucket.misses];
    return {
      weekIndex,
      start: start.toISOString(),
      end: end.toISOString(),
      hitCount: bucket.hits.length,
      missCount: bucket.misses.length,
      hitRate: eligible.length ? bucket.hits.length / eligible.length : null,
      execution: {
        allEligible: stats(eligible),
        hits: stats(bucket.hits),
        misses: stats(bucket.misses),
      },
    };
  });
  const weeklyMeans = weekly
    .map((item) => item.execution.allEligible.meanSeconds)
    .filter((value) => value !== null);
  const representative = group[0];
  return {
    repository: representative.repository,
    workflowName: representative.workflowName,
    comparisonJobIdentity: representative.comparisonJobIdentity,
    artifactKey: representative.artifactKey,
    runnerPlatform: representative.runnerPlatform,
    weekly,
    rolling: {
      weeksWithExecutionSamples: weeklyMeans.length,
      meanOfWeeklyMeanExecutionSeconds: weeklyMeans.length >= 2 ? mean(weeklyMeans) : null,
    },
    flags: [
      ...(weeklyMeans.length < 2 ? ["insufficient-multi-week-data"] : []),
      "source-and-build-identity-vary-across-weeks",
    ],
  };
}

export function buildReport({ observations, coverage, since, until, rollingWeeks }) {
  const current = observations.filter((item) => {
    const started = item.startedAt ? new Date(item.startedAt) : null;
    return started && started >= since && started <= until;
  });
  const exactComparisons = groupBy(current, (item) => item.exactKey)
    .map(exactComparison)
    .filter((item) => item.hitCount || item.missCount);
  const rollingComparisons = groupBy(observations, (item) => item.rollingKey).map((group) =>
    rollingComparison(group, until, rollingWeeks),
  );
  const hitCount = current.filter((item) => item.reuseOutcome === "hit").length;
  const missCount = current.filter((item) => item.reuseOutcome === "miss").length;
  const eligibleSampleSize = hitCount + missCount;
  const savings = exactComparisons
    .map((item) => item.estimated.totalSecondsSaved)
    .filter((value) => value !== null);
  const estimatedTotalSecondsSaved = savings.length
    ? savings.reduce((sum, value) => sum + value, 0)
    : null;

  return {
    schemaVersion: 1,
    kind: "reusable-workflows/build-artifact-reuse-report",
    generatedAt: new Date().toISOString(),
    window: { since: since.toISOString(), until: until.toISOString(), rollingWeeks },
    coverage,
    currentWindow: {
      sampleSize: current.length,
      eligibleSampleSize,
      hitCount,
      missCount,
      hitRate: eligibleSampleSize ? hitCount / eligibleSampleSize : null,
      failedOrUnclassifiedCount: current.filter(
        (item) => !["hit", "miss"].includes(item.reuseOutcome),
      ).length,
      exactComparisonGroupCount: exactComparisons.length,
      groupsWithObservedMissBaseline: exactComparisons.filter(
        (item) => item.estimated.baselineExecutionSeconds !== null,
      ).length,
      estimatedTotalSecondsSaved,
      estimatedTotalMinutesSaved:
        estimatedTotalSecondsSaved === null ? null : estimatedTotalSecondsSaved / 60,
    },
    observations,
    exactComparisons,
    rollingComparisons,
    caveats: [
      "Execution time is job started_at to completed_at; queue delay is created_at to started_at when GitHub exposes created_at.",
      "Raw hit/miss durations are measured; savings are counterfactual estimates from an observed exact-group miss baseline.",
      "Exact comparisons use only the requested reporting window and require repository, workflow/job, normalized source SHA, build identity digest, and runner platform to match.",
      "Reuse-disabled/ineligible jobs and jobs whose exact build contract cannot be recovered are excluded and counted in coverage.",
      "Rolling comparisons fix repository, workflow/job, artifact key, and runner platform but allow source/build identity to vary, so they are weaker trend evidence.",
    ],
  };
}

function gh(args, json = true) {
  const result = spawnSync("gh", ["api", ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `gh api exited with ${result.status}`);
  }
  return json ? JSON.parse(result.stdout) : result.stdout;
}

function paged(payload, key) {
  return (Array.isArray(payload) ? payload : [payload]).flatMap((page) => page[key] ?? []);
}

function collect(options) {
  const fetchSince = new Date(
    Math.min(options.since.getTime(), options.until.getTime() - options.rollingWeeks * WEEK_MS),
  );
  const observations = [];
  const coverage = {
    scope: "rolling-fetch-window",
    fetchSince: fetchSince.toISOString(),
    fetchUntil: options.until.toISOString(),
    candidateBuildArtifactJobs: 0,
    reuseEligibleJobs: 0,
    contractResolvedJobs: 0,
    excludedReuseDisabledOrIneligible: 0,
    excludedMissingContract: 0,
    jobLogReadFailures: 0,
  };

  for (const repo of options.repos) {
    const runs = paged(
      gh([
        "--paginate",
        "--slurp",
        "-X",
        "GET",
        `repos/${repo}/actions/runs`,
        "-f",
        "per_page=100",
        "-f",
        `created=>=${fetchSince.toISOString()}`,
      ]),
      "workflow_runs",
    ).filter(
      (run) => new Date(run.created_at) >= fetchSince && new Date(run.created_at) <= options.until,
    );

    for (const run of runs) {
      const jobs = paged(
        gh([
          "--paginate",
          "--slurp",
          `repos/${repo}/actions/runs/${run.id}/jobs?per_page=100&filter=all`,
        ]),
        "jobs",
      );
      for (const job of jobs) {
        if (!step(job, IDENTITY_STEP) || !step(job, BUILD_STEP)) continue;
        coverage.candidateBuildArtifactJobs += 1;
        if (classifyBuildArtifactJob(job) === null) {
          coverage.excludedReuseDisabledOrIneligible += 1;
          continue;
        }
        coverage.reuseEligibleJobs += 1;

        let contract;
        try {
          contract = parseBuildArtifactContract(
            gh([`repos/${repo}/actions/jobs/${job.id}/logs`], false),
          );
        } catch {
          coverage.jobLogReadFailures += 1;
          continue;
        }
        if (!contract.sourceSha || !contract.artifactKey || !contract.identityDigest) {
          coverage.excludedMissingContract += 1;
          continue;
        }
        coverage.contractResolvedJobs += 1;
        const observation = observationFromJob({
          repo,
          run,
          job,
          contract,
          collapseCallerPrefix: options.collapseCallerPrefix,
        });
        if (observation) observations.push(observation);
      }
    }
  }
  return { observations, coverage };
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
    if (arg === "--repo") options.repos.push(argv[++index]);
    else if (arg === "--since") options.since = asDate(argv[++index], "--since");
    else if (arg === "--until") options.until = asDate(argv[++index], "--until");
    else if (arg === "--rolling-weeks") {
      options.rollingWeeks = Number.parseInt(argv[++index], 10);
    } else if (arg === "--collapse-caller-job-prefix") options.collapseCallerPrefix = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!Number.isInteger(options.rollingWeeks) || options.rollingWeeks < 1) {
    throw new Error("--rolling-weeks must be positive");
  }
  options.since ??= new Date(options.until.getTime() - WEEK_MS);
  if (options.since > options.until) throw new Error("--since must not be after --until");
  return options;
}

function usage() {
  return `Usage: bun scripts/report-build-artifact-reuse.mjs --repo OWNER/REPO [--repo OWNER/REPO ...]\n\nOptions:\n  --since ISO\n  --until ISO\n  --rolling-weeks N\n  --collapse-caller-job-prefix  Pair exact build identities across different caller job prefixes.\n`;
}

export function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) return process.stdout.write(usage());
  if (!options.repos.length) throw new Error("at least one --repo OWNER/REPO is required");
  const { observations, coverage } = collect(options);
  process.stdout.write(
    `${JSON.stringify(
      buildReport({
        observations,
        coverage,
        since: options.since,
        until: options.until,
        rollingWeeks: options.rollingWeeks,
      }),
      null,
      2,
    )}\n`,
  );
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
