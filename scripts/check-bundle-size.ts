/* eslint-disable no-console */

import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

export type BundleSizeReport = {
  budgetBytes: number;
  budgetUsagePercent: number;
  jsBytes: number;
  warningThresholdBytes: number;
  withinBudget: boolean;
};

type CheckBundleSizeOptions = {
  budgetBytes?: number;
  distDir?: string;
  onWarning?: (message: string) => void;
  resultsDir?: string;
  warningRatio?: number;
};

const defaultBudgetBytes = 425 * 1024;
const defaultWarningRatio = 0.95;

export function createBundleSizeReport({
  budgetBytes = defaultBudgetBytes,
  distDir = "dist",
  warningRatio = defaultWarningRatio,
}: CheckBundleSizeOptions = {}): BundleSizeReport {
  const resolvedDistDir = path.resolve(distDir);
  const jsBytes = collectFiles(resolvedDistDir)
    .filter((filePath) => filePath.endsWith(".js"))
    .reduce((total, filePath) => total + statSync(filePath).size, 0);
  const warningThresholdBytes = Math.floor(budgetBytes * warningRatio);

  return {
    jsBytes,
    budgetBytes,
    budgetUsagePercent: Math.round((jsBytes / budgetBytes) * 1000) / 10,
    warningThresholdBytes,
    withinBudget: jsBytes <= budgetBytes,
  };
}

export function checkBundleSize(options: CheckBundleSizeOptions = {}) {
  const resultsDir = options.resultsDir ?? "performance-results";
  const report = createBundleSizeReport(options);

  mkdirSync(resultsDir, { recursive: true });
  writeFileSync(path.join(resultsDir, "bundle-size.json"), `${JSON.stringify(report, null, 2)}\n`);

  if (!report.withinBudget) {
    throw new Error(
      `JavaScript bundle is ${report.jsBytes} bytes, above the ${report.budgetBytes} byte budget.`,
    );
  }

  if (report.jsBytes >= report.warningThresholdBytes) {
    const warning =
      `JavaScript bundle is ${report.jsBytes} bytes ` +
      `(${report.budgetUsagePercent}% of the ${report.budgetBytes} byte budget).`;
    const warn = options.onWarning ?? console.warn;

    warn(warning);
  }

  return report;
}

function collectFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const entryPath = path.join(dir, entry);

    return statSync(entryPath).isDirectory() ? collectFiles(entryPath) : [entryPath];
  });
}

if (import.meta.main) {
  const report = checkBundleSize();

  console.log(
    `JavaScript bundle size ${report.jsBytes} bytes is within the ${report.budgetBytes} byte budget.`,
  );
}
