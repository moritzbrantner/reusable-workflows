import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const script = resolve(import.meta.dirname, "../.github/actions/install-verified-wasm-cli/install.sh");
const action = resolve(import.meta.dirname, "../.github/actions/install-verified-wasm-cli/action.yml");

describe("verified WASM CLI action", () => {
  it("retains exact SHA-256 pins for supported release identities", () => {
    const source = readFileSync(script, "utf8");
    const workflowAction = readFileSync(action, "utf8");

    expect(source).toContain("sha256sum --check --status");
    expect(source).toContain("wasm-pack/0.14.0/Linux-x86_64)");
    expect(source).toContain("wasm-pack/0.14.0/Linux-aarch64)");
    expect(source).toContain("wasm-bindgen/0.2.129/Linux-x86_64)");
    expect(source).toContain("wasm-bindgen/0.2.129/Linux-aarch64)");
    expect([...source.matchAll(/^\s+digest=([a-f0-9]{64})$/gm)].map((match) => match[1])).toEqual([
      "278a8d668085821f4d1a637bd864f1713f872b0ae3a118c77562a308c0abfe8d",
      "5941c7b05060440ff37ee50fe9009a408e63fa5ba607a3b0736f5a887ec5f2ca",
      "82d12bb940e2d4e72e0d5605387fc1b8ca179044e012b620f0ce4e7440e8320e",
      "2ed4351c35dd9440308bbb02767d47ea278efe851a52465300f3c94f5b6c2a87",
    ]);
    expect(workflowAction).toContain('bash "$GITHUB_ACTION_PATH/install.sh"');
  });

  it("rejects unsupported versions before network activity", () => {
    const dir = mkdtempSync(join(tmpdir(), "verified-wasm-cli-test-"));
    try {
      const githubPath = join(dir, "github-path");
      writeFileSync(githubPath, "");
      const result = spawnSync("bash", [script], {
        encoding: "utf8",
        env: {
          ...process.env,
          VERIFIED_WASM_TOOL: "wasm-pack",
          VERIFIED_WASM_VERSION: "0.14.1",
          RUNNER_TEMP: dir,
          GITHUB_PATH: githubPath,
        },
      });
      expect(result.status).toBe(2);
      expect(result.stderr).toContain("Unsupported verified WASM CLI identity");
      expect(readFileSync(githubPath, "utf8")).toBe("");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects corrupted downloads without installing a CLI", () => {
    const dir = mkdtempSync(join(tmpdir(), "verified-wasm-cli-test-"));
    try {
      const fakeBin = join(dir, "bin");
      mkdirSync(fakeBin);
      const fakeCurl = join(fakeBin, "curl");
      writeFileSync(fakeCurl, [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        "while [[ $# -gt 0 ]]; do",
        '  if [[ "$1" == "--output" ]]; then',
        '    printf "invalid bytes" > "$2"',
        "    exit 0",
        "  fi",
        "  shift",
        "done",
        "exit 1",
        "",
      ].join("\n"));
      chmodSync(fakeCurl, 0o755);
      const githubPath = join(dir, "github-path");
      writeFileSync(githubPath, "");
      const result = spawnSync("bash", [script], {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: fakeBin + ":" + process.env.PATH,
          VERIFIED_WASM_TOOL: "wasm-pack",
          VERIFIED_WASM_VERSION: "0.14.0",
          RUNNER_TEMP: dir,
          GITHUB_PATH: githubPath,
        },
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("SHA-256 mismatch");
      expect(existsSync(join(dir, "verified-wasm-cli/wasm-pack/0.14.0/bin/wasm-pack"))).toBe(false);
      expect(readFileSync(githubPath, "utf8")).toBe("");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
