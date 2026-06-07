/* eslint-disable no-console */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import {
  buildMetricsEntryFromReports,
  buildMetricsMarkdown,
  parseJsonObject,
} from "../src/build-metrics";

function readOptionalJson(path: string): unknown {
  if (!existsSync(path)) {
    return null;
  }

  return parseJsonObject(readFileSync(path, "utf8"), path);
}

const completedAt = new Date().toISOString();
const entry = buildMetricsEntryFromReports({
  benchmarkReport: readOptionalJson("benchmark-results/workflow-contracts.json"),
  buildReport: readOptionalJson("performance-results/build.json"),
  bundleReport: readOptionalJson("performance-results/bundle-size.json"),
  completedAt,
  env: process.env,
  lighthouseReport: readOptionalJson(".unlighthouse/ci-result.json"),
});

mkdirSync("performance-results", { recursive: true });
writeFileSync("performance-results/current-build.json", `${JSON.stringify(entry, null, 2)}\n`);
writeFileSync("performance-results/current-build.md", buildMetricsMarkdown(entry));

console.log(`Wrote current build metrics for run ${entry.runId}.`);
