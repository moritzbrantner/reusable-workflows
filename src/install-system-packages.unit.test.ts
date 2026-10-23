import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const script = resolve(
  import.meta.dirname,
  "../.github/actions/install-system-packages/install.sh",
);
const action = resolve(
  import.meta.dirname,
  "../.github/actions/install-system-packages/action.yml",
);

let dir: string;
let bin: string;

function stub(name: string, body: string) {
  const path = join(bin, name);
  writeFileSync(path, `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(path, 0o755);
}

function run(command: string, env: Record<string, string>) {
  const outputPath = join(dir, "github-output");
  writeFileSync(outputPath, "");
  const result = spawnSync("bash", [script, command], {
    encoding: "utf8",
    env: {
      PATH: bin,
      HOME: dir,
      RUNNER_TEMP: dir,
      GITHUB_OUTPUT: outputPath,
      ImageOS: "ubuntu24",
      ...env,
    },
  });
  const outputs = Object.fromEntries(
    readFileSync(outputPath, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );
  const aptLog = (() => {
    try {
      return readFileSync(join(dir, "apt.log"), "utf8");
    } catch {
      return "";
    }
  })();
  return { ...result, outputs, aptLog };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "install-system-packages-test-"));
  bin = join(dir, "bin");
  mkdirSync(bin);
  // Only these host tools are visible, so host-installed packages cannot leak into results.
  for (const tool of [
    "bash",
    "python3",
    "sha256sum",
    "awk",
    "sort",
    "grep",
    "cut",
    "uname",
    "basename",
    "mkdir",
    "rm",
    "chown",
    "id",
    "tee",
    "mv",
    "sed",
    "cat",
    "env",
  ]) {
    const found = spawnSync("bash", ["-c", `command -v ${tool}`], {
      encoding: "utf8",
    }).stdout.trim();
    symlinkSync(found, join(bin, tool));
  }
  stub("sudo", 'exec "$@"');
  stub("timeout", 'shift; exec "$@"');
  // xvfb is dpkg-installed; everything else is absent.
  stub("dpkg-query", 'if [[ "${@: -1}" == xvfb ]]; then printf "ii "; exit 0; fi; exit 1');
  stub(
    "apt-get",
    `echo "$*" >> "${dir}/apt.log"
if [[ "$*" == *--print-uris* ]]; then
  for p in "$@"; do
    case "$p" in -*|install|Acquire*|Dir::*) ;; *) echo "'http://archive/$p.deb' \${p}_1_amd64.deb 10 SHA256:00";; esac
  done
fi`,
  );
  // cmake is provided by the image outside dpkg.
  stub("cmake", "exit 0");
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("install-system-packages action", () => {
  it("wires resolve, cache restore, install and cache save", () => {
    const source = readFileSync(action, "utf8");
    expect(source).toContain('bash "$GITHUB_ACTION_PATH/install.sh" resolve');
    expect(source).toContain('bash "$GITHUB_ACTION_PATH/install.sh" install');
    expect(source).toContain("actions/cache/restore@");
    expect(source).toContain("actions/cache/save@");
  });

  it("does not contact apt when the image already provides every package", () => {
    const result = run("resolve", { SYSTEM_PACKAGES: "xvfb cmake" });
    expect(result.status, result.stderr).toBe(0);
    expect(result.outputs.packages).toBe("");
    expect(result.aptLog).toBe("");
  });

  it("resolves only missing packages from inputs and the environment file", () => {
    const environment = join(dir, ".repository-environment.toml");
    writeFileSync(environment, 'schema_version = 1\n[system]\napt = ["cmake", "ffmpeg"]\n');
    const result = run("resolve", {
      SYSTEM_PACKAGES: "xvfb tesseract-ocr",
      SYSTEM_PACKAGES_ENVIRONMENT_FILE: environment,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.outputs.packages).toBe("ffmpeg tesseract-ocr");
    expect(result.outputs.cache_key.startsWith(result.outputs.restore_prefix)).toBe(true);
    expect(result.outputs.restore_prefix).toMatch(/^system-packages-v1-ubuntu24-/);
    expect(result.aptLog).toContain("update -qq");
    expect(result.aptLog).toContain("Acquire::Retries=3");
    expect(readFileSync(`${result.outputs.archive_dir}.wanted`, "utf8")).toBe(
      "ffmpeg_1_amd64.deb\ntesseract-ocr_1_amd64.deb\n",
    );
  });

  it.each([
    ["Missing system dependencies (2):\n  libgtk-4-1\n  xvfb\n", "libgtk-4-1"],
    [
      'sudo -- sh -c "apt-get update&& apt-get install -y --no-install-recommends libnss3 xvfb"',
      "libnss3",
    ],
  ])("reads Playwright system dependencies from %j", (report, expected) => {
    writeFileSync(join(dir, "report.txt"), report);
    stub("playwright", `cat "${dir}/report.txt"; exit 1`);
    const result = run("resolve", {
      SYSTEM_PACKAGES_PLAYWRIGHT: "true",
      SYSTEM_PACKAGES_PLAYWRIGHT_CLI: "playwright",
      SYSTEM_PACKAGES_PLAYWRIGHT_BROWSERS: "chromium",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.outputs.packages).toBe(expected);
  });

  it("fails loudly when the Playwright report is unreadable", () => {
    stub("playwright", "echo boom; exit 3");
    const result = run("resolve", {
      SYSTEM_PACKAGES_PLAYWRIGHT: "true",
      SYSTEM_PACKAGES_PLAYWRIGHT_CLI: "playwright",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("could not read Playwright system dependencies");
  });

  it("downloads into the cached archive, installs offline and prunes stale debs", () => {
    const archive = join(dir, "system-packages-archives");
    mkdirSync(archive, { recursive: true });
    writeFileSync(`${archive}.wanted`, "ffmpeg_1_amd64.deb\n");
    writeFileSync(join(archive, "ffmpeg_1_amd64.deb"), "");
    writeFileSync(join(archive, "ffmpeg_0_amd64.deb"), "");
    const result = run("install", { SYSTEM_PACKAGES_MISSING: "ffmpeg" });
    expect(result.status, result.stderr).toBe(0);
    const calls = result.aptLog.trim().split("\n");
    expect(calls[0]).toContain("install --download-only -y --no-install-recommends ffmpeg");
    expect(calls[1]).toContain("install -y --no-download --no-install-recommends ffmpeg");
    expect(calls[1]).toContain(`Dir::Cache::Archives=${archive}`);
    expect(spawnSync("ls", [archive], { encoding: "utf8" }).stdout).toBe("ffmpeg_1_amd64.deb\n");
  });
});
