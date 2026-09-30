import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

describe("repository validation scheduling", () => {
  test("keeps ordinary validation direct and free of reusable validation evidence", () => {
    const validate = readFileSync(
      new URL("../.github/workflows/validate.yml", import.meta.url),
      "utf8",
    );
    const smoke = readFileSync(
      new URL("../.github/workflows/smoke-reusable-workflows.yml", import.meta.url),
      "utf8",
    );

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

  test("keeps deployment qualification separate from ordinary validation", () => {
    const deployDocsPages = readFileSync(
      new URL("../.github/workflows/deploy-docs-pages.yml", import.meta.url),
      "utf8",
    );

    expect(deployDocsPages).toContain('qualification_command: "bun run validate:semantic"');
    expect(deployDocsPages).toContain(
      'build_command: "bun scripts/prepare-build-metrics-history.ts && bun run build && bun run size:check:dist"',
    );
    expect(deployDocsPages).not.toContain('qualification_command: "bun run validate:fast"');
  });
});
