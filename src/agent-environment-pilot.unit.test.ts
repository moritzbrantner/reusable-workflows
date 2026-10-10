import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const directory = resolve("experiments/agent-environments");

describe("optional agent-environment pilot", () => {
  it("runs the common task and receipt checks without external dependencies", () => {
    const command = spawnSync(
      process.execPath,
      ["--test", resolve(directory, "probe-check.mjs"), resolve(directory, "record-check.mjs")],
      { encoding: "utf8", timeout: 15000 },
    );
    expect(command.status, command.stderr).toBe(0);
  });

  it("binds successful output to the exact checked-in fixture bytes", () => {
    const command = spawnSync(process.execPath, [resolve(directory, "probe.mjs")], {
      encoding: "utf8",
      timeout: 15000,
    });
    expect(command.status, command.stderr).toBe(0);
    const marker = command.stdout.trim().split("ENV_PILOT_RESULT=")[1];
    expect(marker).toBeDefined();
    const parsed = JSON.parse(marker!) as {
      fixtureSha256: string;
      status: string;
      cases: number;
    };
    expect(parsed.status).toBe("passed");
    expect(parsed.cases).toBe(4);
    expect(parsed.fixtureSha256).toBe(
      createHash("sha256")
        .update(readFileSync(resolve(directory, "fixture.json")))
        .digest("hex"),
    );
  });
});
