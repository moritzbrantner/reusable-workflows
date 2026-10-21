import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

describe("repository validation scheduling", () => {
  test("keeps renamed-source scope and current PR labels required across reruns", () => {
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
      git("add", "-A", "--", ".", ":!bin", ":!event.json", ":!output", ":!current-pr.json");
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
      git("config", "diff.renames", "true");
      mkdirSync(join(root, "src/app"), { recursive: true });
      writeFileSync(join(root, "src/app/workflowCatalog.ts"), "export const example = 1;\n");
      const base = commit();
      mkdirSync(join(root, "docs"));
      renameSync(join(root, "src/app/workflowCatalog.ts"), join(root, "docs/catalog.md"));
      const head = commit();
      const eventPath = join(root, "event.json");
      const outputPath = join(root, "output");
      writeFileSync(eventPath, JSON.stringify({ number: 1, pull_request: { labels: [] } }));
      const bin = join(root, "bin");
      const response = join(root, "current-pr.json");
      mkdirSync(bin);
      writeFileSync(join(bin, "gh"), `#!/bin/sh\ncat '${response}'\n`, { mode: 0o755 });
      writeFileSync(response, JSON.stringify({ head: { sha: head }, labels: [] }));
      const runScope = (range = { BASE_SHA: base, HEAD_SHA: head }) =>
        execFileSync("python3", ["-c", scope], {
          cwd: root,
          stdio: "pipe",
          env: {
            ...process.env,
            PATH: `${bin}:${process.env.PATH ?? ""}`,
            GITHUB_REPOSITORY: "fixture/repository",
            ...range,
            GITHUB_EVENT_NAME: "pull_request",
            GITHUB_EVENT_PATH: eventPath,
            GITHUB_OUTPUT: outputPath,
          },
        });
      runScope();
      expect(readFileSync(outputPath, "utf8")).toContain("smoke=true\n");
      // A rename out of src/ touches a site input, so the Pages artifact still builds.
      expect(readFileSync(outputPath, "utf8")).toContain("artifact-build=true\n");

      writeFileSync(join(root, "README.md"), "docs\n");
      writeFileSync(join(root, "docs/catalog.md"), "changed\n");
      const docsOnly = commit();
      const docsRange = { BASE_SHA: head, HEAD_SHA: docsOnly };
      writeFileSync(response, JSON.stringify({ head: { sha: docsOnly }, labels: [] }));
      writeFileSync(outputPath, "");
      runScope(docsRange);
      const docsScope = readFileSync(outputPath, "utf8");
      expect(docsScope).toContain("artifact-build=false\n");
      expect(JSON.parse(docsScope.split("allow-skipped=")[1]?.split("\n")[0] ?? "null")).toContain(
        "artifact-build",
      );
      writeFileSync(
        response,
        JSON.stringify({ head: { sha: docsOnly }, labels: [{ name: "ci:e2e" }] }),
      );
      writeFileSync(outputPath, "");
      runScope(docsRange);
      expect(readFileSync(outputPath, "utf8")).toContain("artifact-build=true\n");
      writeFileSync(response, JSON.stringify({ head: { sha: docsOnly }, labels: [] }));
      writeFileSync(outputPath, "");
      runScope({ BASE_SHA: docsOnly, HEAD_SHA: docsOnly });
      expect(readFileSync(outputPath, "utf8")).toContain("artifact-build=true\n");
      writeFileSync(response, JSON.stringify({ head: { sha: head }, labels: [] }));
      writeFileSync(
        response,
        JSON.stringify({ head: { sha: head }, labels: [{ name: "CI:PERF" }] }),
      );
      writeFileSync(outputPath, "");
      runScope();
      const promoted = readFileSync(outputPath, "utf8");
      expect(promoted).toContain("performance-validation=true\n");
      const skipped = promoted.split("allow-skipped=")[1]?.split("\n")[0];
      expect(JSON.parse(skipped ?? "null")).not.toContain("performance-validation");
      writeFileSync(
        eventPath,
        JSON.stringify({ number: 1, pull_request: { labels: [{ name: "ci:perf" }] } }),
      );
      writeFileSync(response, JSON.stringify({ head: { sha: head }, labels: [] }));
      writeFileSync(outputPath, "");
      runScope();
      expect(readFileSync(outputPath, "utf8")).toContain("performance-validation=false\n");
      writeFileSync(response, JSON.stringify({ head: { sha: "stale-head" }, labels: [] }));
      writeFileSync(outputPath, "");
      expect(runScope).toThrow();
      expect(readFileSync(outputPath, "utf8")).toBe("");
      writeFileSync(join(bin, "gh"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
      expect(runScope).toThrow();
      expect(readFileSync(outputPath, "utf8")).toBe("");
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

    expect(validate).toContain("needs: [validation-scope, coding-tooling-fast, actionlint]");
    expect(validate).toContain("(github.event_name == 'push' && github.ref == 'refs/heads/main')");
    expect(validate).toContain("needs.validation-scope.outputs.e2e-validation == 'true'");
    expect(validate).toContain("needs.validation-scope.outputs.performance-validation == 'true'");
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

    expect(validate).toContain(
      "needs: [validation-scope, coding-tooling-fast, actionlint, performance-validation]",
    );
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
