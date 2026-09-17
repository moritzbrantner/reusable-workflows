import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

const workflowPath = join(
  import.meta.dir,
  "..",
  ".github",
  "workflows",
  "coding-tooling-validation.yml",
);

describe("coding-tooling validation environment authority", () => {
  test("prepares environment-v1 before run operations and disables duplicate installation", () => {
    const source = readFileSync(workflowPath, "utf8");

    expect(source).toContain("OPERATION\" == \"run\"");
    expect(source).toContain(".repository-environment.toml");
    expect(source).toContain("bash scripts/codex-environment.sh setup");
    expect(source).toContain("Verify environment-v1 preserves tracked state");
    expect(source).toContain("install_mode=none");
    expect(source).toContain("install-mode: ${{ steps.preparation.outputs.install_mode }}");
  });

  test("preserves environment preparation outcomes in the execution receipt", () => {
    const source = readFileSync(workflowPath, "utf8");

    expect(source).toContain('"environmentSetup": os.environ["ENVIRONMENT_SETUP_OUTCOME"]');
    expect(source).toContain('"environmentState": os.environ["ENVIRONMENT_STATE_OUTCOME"]');
  });
});
