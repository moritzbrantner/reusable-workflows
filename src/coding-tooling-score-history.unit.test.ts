import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

const workflowPath = path.resolve(
  process.cwd(),
  ".github/workflows/coding-tooling-score-history.yml",
);
const source = readFileSync(workflowPath, "utf8");
const codingToolingRevision = "01527f7be1607416bf9cc81a3a3e4d2bfb7355f2";

describe("coding-tooling score history workflow", () => {
  test("delegates score and attribution semantics to one immutable coding-tooling revision", () => {
    expect(source).toContain(`uses: moritzbrantner/coding-tooling@${codingToolingRevision}`);
    expect(source).toContain("repository: moritzbrantner/coding-tooling");
    expect(source).toContain(`ref: ${codingToolingRevision}`);
    expect(source).toContain("scripts/append-score-history.mjs");
  });

  test("preserves failed verification as score evidence without inventing policy", () => {
    expect(source).toMatch(/Capture repository verification[\s\S]*continue-on-error: true/);
    expect(source).toMatch(/Produce repository score snapshot[\s\S]*continue-on-error: true/);
    expect(source).not.toMatch(/score[_ -]?threshold/i);
    expect(source).not.toMatch(/minimum[_ -]?score/i);
  });

  test("reserves a serialized data-only persistence branch", () => {
    expect(source).toContain("cancel-in-progress: false");
    expect(source).toContain('git check-ref-format --branch "$history_branch"');
    expect(source).toContain("grep -vx 'history.json'");
    expect(source).toContain('tracked="$(git -C .score-history ls-files)"');
    expect(source).toContain('[[ "$tracked" != "history.json" ]]');
  });

  test("does not project workflow inputs into repository environment state", () => {
    expect(source).not.toMatch(/^\s+env:\s*$/m);
    expect(source).not.toContain("$HISTORY_BRANCH");
    expect(source).not.toContain("$VALIDATION_TIER");
  });
});
