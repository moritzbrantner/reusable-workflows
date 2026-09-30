import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

const workflowPath = path.resolve(
  process.cwd(),
  ".github/workflows/coding-tooling-score-history.yml",
);
const source = readFileSync(workflowPath, "utf8");
const codingToolingRevision = "main";

describe("coding-tooling score history workflow", () => {
  test("uses one current coding-tooling checkout for validation, scoring, and attribution", () => {
    expect(source).toContain("name: Check out current coding-tooling");
    expect(source.match(/uses: \.\/\.coding-tooling-source/g)).toHaveLength(2);
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

  test("captures repository verification directly instead of trusting another job's receipt", () => {
    expect(source).toContain("Capture repository verification");
    expect(source).not.toContain("Resolve current-run verification candidate");
    expect(source).not.toContain("Reuse exact current-run repository verification");
    expect(source).not.toContain("execution-receipt-coding-tooling");
    expect(source).not.toContain("Download current-run verification receipt");
  });

  test("reserves a serialized data-only persistence branch", () => {
    expect(source).toContain("cancel-in-progress: false");
    expect(source).toContain('git check-ref-format --branch "$history_branch"');
    expect(source).toContain("grep -vx 'history.json'");
    expect(source).toContain('tracked="$(git -C .score-history ls-files)"');
    expect(source).toContain('[[ "$tracked" != "history.json" ]]');
  });

  test("does not project workflow inputs into repository environment state", () => {
    expect(source).not.toMatch(/^    env:\s*$/m);
    expect(source).not.toContain("$HISTORY_BRANCH");
    expect(source).not.toContain("$VALIDATION_TIER");
  });
});
