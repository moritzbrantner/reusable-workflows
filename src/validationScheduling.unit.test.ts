import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

describe("repository validation scheduling", () => {
  test("keeps smoke validation required when source is renamed into documentation", () => {
    const validate = readFileSync(
      new URL("../.github/workflows/validate.yml", import.meta.url),
      "utf8",
    );
    const body = validate.split("        run: |\n")[1]?.split("\n  coding-tooling-fast:")[0];
    if (!body) {
      throw new Error("Validation scope script is missing");
    }
    const scope = body
      .split("\n")
      .map((line) => line.slice(10))
      .join("\n");
    const root = mkdtempSync(join(tmpdir(), "validation-scope-"));
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
    const commit = () => {
      git("add", ".");
      git(
        "-c",
        "user.name=Scope Test",
        "-c",
        "user.email=scope@example.invalid",
        "commit",
        "-qm",
        "fixture",
      );
      return git("rev-parse", "HEAD");
    };
    try {
      git("init", "-q");
      mkdirSync(join(root, "src/app"), { recursive: true });
      writeFileSync(join(root, "src/app/workflowCatalog.ts"), "export const example = 1;\n");
      const base = commit();
      mkdirSync(join(root, "docs"));
      renameSync(join(root, "src/app/workflowCatalog.ts"), join(root, "docs/catalog.md"));
      const head = commit();
      const eventPath = join(root, "event.json");
      const outputPath = join(root, "output");
      writeFileSync(eventPath, JSON.stringify({ pull_request: { labels: [] } }));
      execFileSync("python3", ["-c", scope], {
        cwd: root,
        env: {
          ...process.env,
          BASE_SHA: base,
          HEAD_SHA: head,
          GITHUB_EVENT_NAME: "pull_request",
          GITHUB_EVENT_PATH: eventPath,
          GITHUB_OUTPUT: outputPath,
        },
      });
      expect(readFileSync(outputPath, "utf8")).toContain("smoke=true\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("keeps ordinary validation direct and free of reusable validation evidence", () => {
    const validate = readFileSync(
      new URL("../.github/workflows/validate.yml", import.meta.url),
      "utf8",
    );
    const smoke = validate;

    expect(validate).not.toContain("validation-impact.yml");
    expect(validate).not.toContain("validation-evidence.yml");
    expect(validate).not.toContain("impact_unit:");
    expect(validate).not.toContain("preserve_success_evidence");
    expect(smoke).not.toContain("validation-impact.yml");
    expect(smoke).not.toContain("validation-evidence.yml");
    expect(smoke).not.toContain("reuse_reason");
    expect(smoke).not.toContain("fingerprint_digest");
  });

  test("keeps expensive validation explicit rather than hidden behind inference", () => {
    const validate = readFileSync(
      new URL("../.github/workflows/validate.yml", import.meta.url),
      "utf8",
    );

    expect(validate).toContain("needs: [coding-tooling-fast, actionlint]");
    expect(validate).toContain("(github.event_name == 'push' && github.ref == 'refs/heads/main')");
    expect(validate).toContain("contains(github.event.pull_request.labels.*.name, 'ci:e2e')");
    expect(validate).toContain("contains(github.event.pull_request.labels.*.name, 'ci:perf')");
  });

  test("builds Pages once in validation and reuses the exact artifact for deployment", () => {
    const validate = readFileSync(
      new URL("../.github/workflows/validate.yml", import.meta.url),
      "utf8",
    );
    const deployDocsPages = readFileSync(
      new URL("../.github/workflows/deploy-docs-pages.yml", import.meta.url),
      "utf8",
    );

    const buildCommand =
      'build_command: "bun scripts/prepare-build-metrics-history.ts && bun run build && bun run size:check:dist"';

    expect(validate).toContain("needs: [coding-tooling-fast, actionlint, performance-validation]");
    expect(validate).toContain("github.event_name == 'pull_request'");
    expect(validate).toContain(buildCommand);
    expect(validate).toContain("reuse_across_runs: true");

    expect(deployDocsPages).toContain("uses: ./.github/workflows/build-artifact.yml");
    expect(deployDocsPages).toContain(buildCommand);
    expect(deployDocsPages).toContain("reuse_across_runs: true");
    expect(deployDocsPages).toContain("uses: ./.github/workflows/deploy-pages.yml");
    expect(deployDocsPages).toContain(
      "prebuilt_artifact_run_id: ${{ needs.build-pages.outputs.producer_run_id }}",
    );
    expect(deployDocsPages).not.toContain("release-qualification.yml");
    expect(deployDocsPages).not.toContain("artifact-promotion.yml");
  });
});
