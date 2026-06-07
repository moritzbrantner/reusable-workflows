/* eslint-disable no-console */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  emptyBuildMetricsHistory,
  mergeBuildMetricsHistory,
  normalizeBuildMetricsHistory,
  parseJsonObject,
} from "../src/build-metrics";
import type { BuildMetricsEntry } from "../src/build-metrics";

type WorkflowRunEvent = {
  workflow_run?: {
    id?: number;
    head_branch?: string;
    conclusion?: string;
  };
};

type ArtifactList = {
  artifacts?: Array<{
    name?: string;
    archive_download_url?: string;
  }>;
};

const artifactName = "performance-validation-artifacts";
const outputPaths = [
  "src/generated/build-metrics-history.json",
  "public/metrics/build-history.json",
];

async function main() {
  const generatedAt = new Date().toISOString();
  const previousHistory = await fetchPreviousHistory(generatedAt);
  const currentBuild = await fetchCurrentBuild();
  const nextHistory = mergeBuildMetricsHistory(previousHistory, currentBuild, generatedAt);

  for (const outputPath of outputPaths) {
    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(nextHistory, null, 2)}\n`);
  }

  console.log(`Prepared build metrics history with ${nextHistory.builds.length} build(s).`);
}

async function fetchPreviousHistory(generatedAt: string) {
  const localFallback = "src/generated/build-metrics-history.json";
  const historyUrl = process.env.METRICS_HISTORY_URL ?? defaultMetricsHistoryUrl();

  if (historyUrl) {
    try {
      const response = await fetch(historyUrl, {
        headers: { accept: "application/json" },
      });

      if (response.ok) {
        return normalizeBuildMetricsHistory(
          parseJsonObject(await response.text(), historyUrl),
          generatedAt,
        );
      }

      if (response.status !== 404) {
        console.warn(`Could not fetch previous metrics history: ${response.status}`);
      }
    } catch (error) {
      console.warn(`Could not fetch previous metrics history: ${String(error)}`);
    }
  }

  if (existsSync(localFallback)) {
    return normalizeBuildMetricsHistory(
      parseJsonObject(readFileSync(localFallback, "utf8"), localFallback),
      generatedAt,
    );
  }

  return emptyBuildMetricsHistory(generatedAt);
}

async function fetchCurrentBuild(): Promise<BuildMetricsEntry | null> {
  const event = readWorkflowEvent();
  const runId = event.workflow_run?.id;

  if (!runId) {
    return null;
  }

  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;

  if (!token || !repository) {
    throw new Error(
      "GITHUB_TOKEN and GITHUB_REPOSITORY are required to download metrics artifacts.",
    );
  }

  const artifact = await findArtifact(repository, token, runId);

  if (!artifact.archive_download_url) {
    throw new Error(`Artifact ${artifactName} did not include a download URL.`);
  }

  return downloadCurrentBuild(repository, token, artifact.archive_download_url);
}

function readWorkflowEvent(): WorkflowRunEvent {
  const eventPath = process.env.GITHUB_EVENT_PATH;

  if (!eventPath || !existsSync(eventPath)) {
    return {};
  }

  return parseJsonObject(readFileSync(eventPath, "utf8"), eventPath) as WorkflowRunEvent;
}

async function findArtifact(repository: string, token: string, runId: number) {
  const apiUrl = `${apiBaseUrl()}/repos/${repository}/actions/runs/${runId}/artifacts`;
  const response = await githubFetch(apiUrl, token);

  if (!response.ok) {
    throw new Error(`Could not list workflow artifacts: ${response.status}`);
  }

  const payload = (await response.json()) as ArtifactList;
  const artifact = payload.artifacts?.find((candidate) => candidate.name === artifactName);

  if (!artifact) {
    throw new Error(`Could not find ${artifactName} for workflow run ${runId}.`);
  }

  return artifact;
}

async function downloadCurrentBuild(
  repository: string,
  token: string,
  archiveDownloadUrl: string,
): Promise<BuildMetricsEntry> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "build-metrics-"));
  const archivePath = path.join(tempDir, "artifact.zip");

  try {
    const response = await githubFetch(archiveDownloadUrl, token);

    if (!response.ok) {
      throw new Error(`Could not download ${artifactName}: ${response.status}`);
    }

    await writeFile(archivePath, Buffer.from(await response.arrayBuffer()));

    const unzip = spawnSync(
      "unzip",
      ["-p", archivePath, "performance-results/current-build.json"],
      {
        encoding: "utf8",
      },
    );

    if (unzip.status !== 0 || !unzip.stdout.trim()) {
      throw new Error(
        `Could not extract performance-results/current-build.json from ${artifactName} in ${repository}.`,
      );
    }

    return parseJsonObject(
      unzip.stdout,
      "performance-results/current-build.json",
    ) as BuildMetricsEntry;
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

function githubFetch(url: string, token: string) {
  return fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
    },
  });
}

function defaultMetricsHistoryUrl(): string | null {
  const repository = process.env.GITHUB_REPOSITORY;

  if (!repository) {
    return null;
  }

  const [owner, repo] = repository.split("/");

  return `https://${owner}.github.io/${repo}/metrics/build-history.json`;
}

function apiBaseUrl(): string {
  return process.env.GITHUB_API_URL ?? "https://api.github.com";
}

await main();
