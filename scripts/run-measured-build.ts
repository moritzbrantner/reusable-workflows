/* eslint-disable no-console */

import { mkdirSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { spawnSync } from "node:child_process";

mkdirSync("performance-results", { recursive: true });

const startedAt = new Date().toISOString();
const started = performance.now();
const result = spawnSync("bun", ["run", "build"], {
  stdio: "inherit",
  env: process.env,
});
const durationMs = performance.now() - started;
const completedAt = new Date().toISOString();

writeFileSync(
  "performance-results/build.json",
  `${JSON.stringify(
    {
      command: "bun run build",
      startedAt,
      completedAt,
      durationMs,
      exitCode: result.status ?? 1,
    },
    null,
    2,
  )}\n`,
);

if (result.error) {
  throw result.error;
}

console.log(`Measured build completed in ${durationMs.toFixed(2)} ms.`);

process.exit(result.status ?? 1);
