import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
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
