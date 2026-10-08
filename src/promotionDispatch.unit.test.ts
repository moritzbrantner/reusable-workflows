import { readFileSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { expect, test } from "vitest";
import { parseDocument } from "yaml";

test("reports a failed post-promotion dispatch without failing the completed promotion", () => {
  const workflow = parseDocument(
    readFileSync(new URL("../.github/workflows/promote-branches.yml", import.meta.url), "utf8"),
  );
  const script: unknown = workflow.getIn(["jobs", "promote", "steps", 3, "run"]);
  if (typeof script !== "string") {
    throw new Error("Dispatch script missing");
  }
  const directory = mkdtempSync(join(tmpdir(), "promotion-dispatch-"));
  try {
    writeFileSync(
      join(directory, "gh"),
      '#!/bin/sh\nprintf "%s\\n" "$*" >> "$CALL_LOG"\nexit 1\n',
      { mode: 0o755 },
    );
    const log = join(directory, "calls");
    const result = spawnSync("bash", ["-e", "-c", script], {
      encoding: "utf8",
      timeout: 5000,
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH}`,
        CALL_LOG: log,
        TARGET_BRANCH: "production",
        DISPATCH_WORKFLOWS: "push-only.yml second.yml",
        GITHUB_REPOSITORY: "owner/repo",
      },
    });
    expect(result.status).toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain("::warning::");
    expect(readFileSync(log, "utf8")).toContain("second.yml");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test.each([true, false])("preflight rejects changed workflow files: %s", (changed) => {
  const workflow = parseDocument(
    readFileSync(new URL("../.github/workflows/promote-branches.yml", import.meta.url), "utf8"),
  );
  const script: unknown = workflow.getIn(["jobs", "promote", "steps", 1, "run"]);
  if (typeof script !== "string") throw new Error("Preflight script missing");
  const directory = mkdtempSync(join(tmpdir(), "promotion-preflight-"));
  const git = (...args: string[]) => {
    const result = spawnSync("git", args, {
      cwd: directory,
      encoding: "utf8",
      timeout: 5000,
    });
    if (result.status !== 0) throw new Error(result.stderr);
    return result.stdout.trim();
  };
  try {
    git("init", "--initial-branch=target");
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "Test");
    git("commit", "--allow-empty", "-m", "target");
    const target = git("rev-parse", "HEAD");
    git("checkout", "-b", "source");
    if (changed) {
      git("config", "core.autocrlf", "false");
      const path = join(directory, ".github/workflows");
      mkdirSync(path, { recursive: true });
      writeFileSync(join(path, "deploy.yml"), "name: Deploy\n");
      git("add", ".github/workflows");
    } else {
      writeFileSync(join(directory, "app.txt"), "application change\n");
      git("add", "app.txt");
    }
    git("commit", "-m", "source");
    const tested = git("rev-parse", "HEAD");
    git("remote", "add", "origin", directory);
    const result = spawnSync("bash", ["-e", "-c", script], {
      cwd: directory,
      encoding: "utf8",
      timeout: 5000,
      env: {
        ...process.env,
        SOURCE_BRANCH: "source",
        TARGET_BRANCH: "target",
        TESTED_SHA: tested,
      },
    });
    expect(result.status).toBe(changed ? 1 : 0);
    if (changed) expect(result.stderr).toContain("Token-free promotion cannot change");
    expect(git("rev-parse", "target")).toBe(target);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
