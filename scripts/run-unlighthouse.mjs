/* eslint-disable no-await-in-loop */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const port = process.env.UNLIGHTHOUSE_PORT ?? "4179";
const site = process.env.UNLIGHTHOUSE_SITE ?? `http://127.0.0.1:${port}`;

let previewProcess;
let previewLog = "";
let previewExited = false;

function spawnCommand(command, args, options = {}) {
  return spawn(command, args, {
    stdio: options.stdio ?? "inherit",
    env: process.env,
  });
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawnCommand(command, args);

    child.once("error", reject);
    child.once("close", (code, signal) => {
      resolve({ code: code ?? 1, signal });
    });
  });
}

function startPreviewServer() {
  previewProcess = spawnCommand(
    "bun",
    ["run", "preview", "--", "--host", "127.0.0.1", "--port", port, "--strictPort"],
    {
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  previewProcess.stdout.on("data", (chunk) => {
    previewLog += chunk;
  });
  previewProcess.stderr.on("data", (chunk) => {
    previewLog += chunk;
  });
  previewProcess.once("exit", () => {
    previewExited = true;
  });
}

async function waitForPreviewServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(site, {
        signal: AbortSignal.timeout(1_000),
      });

      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until Vite preview starts accepting connections.
    }

    if (previewExited) {
      throw new Error(previewLog);
    }

    await sleep(500);
  }

  throw new Error(`${previewLog}Timed out waiting for preview at ${site}`);
}

async function cleanup() {
  if (previewProcess && !previewExited) {
    previewProcess.kill("SIGTERM");
    await new Promise((resolve) => previewProcess.once("close", resolve));
  }
}

try {
  if (!existsSync("dist/index.html")) {
    throw new Error("dist/index.html is missing; run `bun run build` before Unlighthouse.");
  }

  if (!process.env.UNLIGHTHOUSE_SITE) {
    startPreviewServer();
    await waitForPreviewServer();
  }

  const result = await runCommand("bunx", [
    "unlighthouse-ci",
    "--site",
    site,
    "--desktop",
    "--urls",
    "/",
    "--budget",
    "40",
    "--reporter",
    "jsonExpanded",
  ]);

  await cleanup();

  if (result.signal) {
    process.kill(process.pid, result.signal);
  }

  process.exit(result.code);
} catch (error) {
  await cleanup();
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
}
