import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { checkBundleSize, createBundleSizeReport } from "../scripts/check-bundle-size";

let tempDirs: string[] = [];

afterEach(() => {
  for (const tempDir of tempDirs) {
    rmSync(tempDir, { force: true, recursive: true });
  }

  tempDirs = [];
});

async function makeDist(jsBytes: number, cssBytes = 50) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "bundle-size-test-"));
  const distDir = path.join(tempDir, "dist");

  tempDirs.push(tempDir);
  mkdirSync(path.join(distDir, "assets"), { recursive: true });
  writeFileSync(path.join(distDir, "assets", "index.js"), "x".repeat(jsBytes));
  writeFileSync(path.join(distDir, "assets", "index.css"), "x".repeat(cssBytes));

  return {
    distDir,
    resultsDir: path.join(tempDir, "performance-results"),
  };
}

describe("bundle size check", () => {
  test("reports usage below the warning threshold", async () => {
    const { distDir } = await makeDist(89);

    expect(
      createBundleSizeReport({
        budgetBytes: 100,
        cssBudgetBytes: 100,
        distDir,
        warningRatio: 0.95,
      }),
    ).toMatchObject({
      budgetBytes: 100,
      budgetUsagePercent: 89,
      cssBudgetBytes: 100,
      cssBudgetUsagePercent: 50,
      cssBytes: 50,
      cssWarningThresholdBytes: 95,
      cssWithinBudget: true,
      jsBytes: 89,
      warningThresholdBytes: 95,
      withinBudget: true,
    });
  });

  test("warns near the budget without failing", async () => {
    const { distDir, resultsDir } = await makeDist(95);
    const warnings: string[] = [];
    const report = checkBundleSize({
      budgetBytes: 100,
      cssBudgetBytes: 100,
      distDir,
      onWarning: (message) => warnings.push(message),
      resultsDir,
      warningRatio: 0.95,
    });

    expect(report.withinBudget).toBe(true);
    expect(warnings).toHaveLength(1);
    expect(JSON.parse(readFileSync(path.join(resultsDir, "bundle-size.json"), "utf8"))).toEqual(
      report,
    );
  });

  test("fails above the hard budget", async () => {
    const { distDir, resultsDir } = await makeDist(101);

    expect(() =>
      checkBundleSize({
        budgetBytes: 100,
        cssBudgetBytes: 100,
        distDir,
        resultsDir,
      }),
    ).toThrow("above the 100 byte budget");
  });

  test("warns and fails against the CSS budget separately", async () => {
    const { distDir, resultsDir } = await makeDist(50, 95);
    const warnings: string[] = [];
    const report = checkBundleSize({
      budgetBytes: 100,
      cssBudgetBytes: 100,
      distDir,
      onWarning: (message) => warnings.push(message),
      resultsDir,
      warningRatio: 0.95,
    });

    expect(report.cssWithinBudget).toBe(true);
    expect(warnings).toEqual(["CSS bundle is 95 bytes (95% of the 100 byte budget)."]);

    const oversized = await makeDist(50, 101);

    expect(() =>
      checkBundleSize({
        budgetBytes: 100,
        cssBudgetBytes: 100,
        distDir: oversized.distDir,
        resultsDir: oversized.resultsDir,
      }),
    ).toThrow("CSS bundle is 101 bytes, above the 100 byte budget.");
  });
});
