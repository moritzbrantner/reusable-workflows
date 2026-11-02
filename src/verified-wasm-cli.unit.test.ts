import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const script = resolve(
  import.meta.dirname,
  "../.github/actions/install-verified-wasm-cli/install.sh",
);
const action = resolve(
  import.meta.dirname,
  "../.github/actions/install-verified-wasm-cli/action.yml",
);

const target =
  process.arch === "arm64" ? "aarch64-unknown-linux-musl" : "x86_64-unknown-linux-musl";

function fixture(dir: string, tool: "wasm-pack" | "wasm-bindgen", version: string) {
  const repository = `wasm-bindgen/${tool}`;
  const tag = tool === "wasm-pack" ? `v${version}` : version;
  const archiveName = `${tool}-${tag}-${target}.tar.gz`;
  const releaseUrl = `https://github.com/${repository}/releases/download/${tag}/${archiveName}`;
  const apiUrl = `https://api.github.com/repos/${repository}/releases/tags/${tag}`;
  const root = `${tool}-${tag}-${target}`;
  const archive = join(dir, archiveName);
  mkdirSync(join(dir, root), { recursive: true });
  const executable = join(dir, root, tool);
  writeFileSync(executable, `#!/usr/bin/env bash\nprintf '${tool} ${version}\\n'\n`);
  chmodSync(executable, 0o755);
  const compressed = spawnSync("tar", ["-czf", archive, "-C", dir, root]);
  expect(compressed.status).toBe(0);
  const digest = `sha256:${createHash("sha256").update(readFileSync(archive)).digest("hex")}`;
  const metadata = join(dir, "metadata.json");
  const asset = { name: archiveName, browser_download_url: releaseUrl, digest };
  writeFileSync(metadata, JSON.stringify({ assets: [asset] }));
  const fakeBin = join(dir, "bin");
  mkdirSync(fakeBin);
  const fakeCurl = join(fakeBin, "curl");
  writeFileSync(
    fakeCurl,
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      'url=""',
      'output=""',
      "while [[ $# -gt 0 ]]; do",
      '  if [[ "$1" == "--output" ]]; then output="$2"; shift 2; continue; fi',
      '  if [[ "$1" == https://* ]]; then url="$1"; fi',
      "  shift",
      "done",
      'if [[ "$url" == "$TEST_API_URL" ]]; then cp "$TEST_RELEASE_METADATA" "$output"; exit 0; fi',
      'if [[ "$url" == "$TEST_RELEASE_URL" ]]; then cp "$TEST_RELEASE_ARCHIVE" "$output"; exit 0; fi',
      'echo "unexpected download URL: $url" >&2',
      "exit 1",
      "",
    ].join("\n"),
  );
  chmodSync(fakeCurl, 0o755);
  const githubPath = join(dir, "github-path");
  writeFileSync(githubPath, "");

  return {
    archive,
    asset,
    metadata,
    githubPath,
    releaseUrl,
    run: () =>
      spawnSync("bash", [script], {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${fakeBin}:${process.env.PATH}`,
          VERIFIED_WASM_TOOL: tool,
          VERIFIED_WASM_VERSION: version,
          RUNNER_TEMP: dir,
          GITHUB_PATH: githubPath,
          TEST_API_URL: apiUrl,
          TEST_RELEASE_URL: releaseUrl,
          TEST_RELEASE_METADATA: metadata,
          TEST_RELEASE_ARCHIVE: archive,
        },
      }),
  };
}

describe("verified WASM CLI action", () => {
  it("trusts only approved publishers and reads upstream digests instead of maintaining pins", () => {
    const source = readFileSync(script, "utf8");
    const workflowAction = readFileSync(action, "utf8");

    expect(source).toContain("sha256sum --check --status");
    expect(source).toContain("repository=wasm-bindgen/wasm-pack");
    expect(source).toContain("repository=wasm-bindgen/wasm-bindgen");
    expect(source).toContain("api.github.com/repos/$repository/releases/tags/$tag");
    expect(source).not.toMatch(/^\s+digest=[a-f0-9]{64}$/m);
    expect(workflowAction).toContain('bash "$GITHUB_ACTION_PATH/install.sh"');
  });

  it("rejects non-exact versions and unapproved tools before network activity", () => {
    const dir = mkdtempSync(join(tmpdir(), "verified-wasm-cli-test-"));
    try {
      const githubPath = join(dir, "github-path");
      writeFileSync(githubPath, "");
      for (const [tool, version] of [
        ["wasm-pack", "latest"],
        ["example.org/evil", "0.14.0"],
      ]) {
        const result = spawnSync("bash", [script], {
          encoding: "utf8",
          env: {
            ...process.env,
            VERIFIED_WASM_TOOL: tool,
            VERIFIED_WASM_VERSION: version,
            RUNNER_TEMP: dir,
            GITHUB_PATH: githubPath,
          },
        });
        expect(result.status).toBe(2);
        expect(result.stderr).toContain("Unsupported verified WASM CLI");
      }
      expect(readFileSync(githubPath, "utf8")).toBe("");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.each([
    ["wasm-pack", "0.14.0"],
    ["wasm-bindgen", "0.2.129"],
  ] as const)("installs a matching official %s archive", (tool, version) => {
    const dir = mkdtempSync(join(tmpdir(), "verified-wasm-cli-test-"));
    try {
      const mock = fixture(dir, tool, version);
      const result = mock.run();
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("publisher digest verified");
      expect(existsSync(join(dir, `verified-wasm-cli/${tool}/${version}/bin/${tool}`))).toBe(true);
      expect(readFileSync(mock.githubPath, "utf8")).toContain(
        `verified-wasm-cli/${tool}/${version}/bin`,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects corrupted downloads without installing a CLI", () => {
    const dir = mkdtempSync(join(tmpdir(), "verified-wasm-cli-test-"));
    try {
      const mock = fixture(dir, "wasm-pack", "0.14.0");
      writeFileSync(mock.archive, "invalid bytes");
      const result = mock.run();
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("SHA-256 mismatch");
      expect(existsSync(join(dir, "verified-wasm-cli/wasm-pack/0.14.0/bin/wasm-pack"))).toBe(false);
      expect(readFileSync(mock.githubPath, "utf8")).toBe("");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects missing publisher digests or unexpected asset URLs", () => {
    const dir = mkdtempSync(join(tmpdir(), "verified-wasm-cli-test-"));
    try {
      const mock = fixture(dir, "wasm-pack", "0.14.0");
      for (const badAsset of [
        { ...mock.asset, digest: null },
        { ...mock.asset, browser_download_url: "https://example.org/malicious.tar.gz" },
      ]) {
        writeFileSync(mock.metadata, JSON.stringify({ assets: [badAsset] }));
        const result = mock.run();
        expect(result.status).toBe(1);
        expect(result.stderr).toContain("Invalid official WASM release metadata");
        expect(readFileSync(mock.githubPath, "utf8")).toBe("");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
