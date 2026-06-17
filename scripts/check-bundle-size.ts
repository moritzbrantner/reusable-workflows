/* eslint-disable no-console */

import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

export type BundleSizeReport = {
  budgetBytes: number;
  budgetUsagePercent: number;
  cssBudgetBytes: number;
  cssBudgetUsagePercent: number;
  cssBytes: number;
  cssWarningThresholdBytes: number;
  cssWithinBudget: boolean;
  jsBytes: number;
  warningThresholdBytes: number;
  withinBudget: boolean;
};

type CheckBundleSizeOptions = {
  budgetBytes?: number;
  cssBudgetBytes?: number;
  distDir?: string;
  onWarning?: (message: string) => void;
  resultsDir?: string;
  warningRatio?: number;
};

const defaultBudgetBytes = 420 * 1024;
const defaultCssBudgetBytes = 120 * 1024;
const defaultWarningRatio = 0.9;

export function createBundleSizeReport({
  budgetBytes = defaultBudgetBytes,
  cssBudgetBytes = defaultCssBudgetBytes,
  distDir = "dist",
  warningRatio = defaultWarningRatio,
}: CheckBundleSizeOptions = {}): BundleSizeReport {
  const resolvedDistDir = path.resolve(distDir);
  const files = collectFiles(resolvedDistDir);
  const jsBytes = sumFilesByExtension(files, ".js");
  const cssBytes = sumFilesByExtension(files, ".css");
  const warningThresholdBytes = Math.floor(budgetBytes * warningRatio);
  const cssWarningThresholdBytes = Math.floor(cssBudgetBytes * warningRatio);

  return {
    budgetBytes,
    budgetUsagePercent: Math.round((jsBytes / budgetBytes) * 1000) / 10,
    cssBudgetBytes,
    cssBudgetUsagePercent: Math.round((cssBytes / cssBudgetBytes) * 1000) / 10,
    cssBytes,
    cssWarningThresholdBytes,
    cssWithinBudget: cssBytes <= cssBudgetBytes,
    jsBytes,
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

  if (!report.cssWithinBudget) {
    throw new Error(
      `CSS bundle is ${report.cssBytes} bytes, above the ${report.cssBudgetBytes} byte budget.`,
    );
  }

  if (report.jsBytes >= report.warningThresholdBytes) {
    const warning =
      `JavaScript bundle is ${report.jsBytes} bytes ` +
      `(${report.budgetUsagePercent}% of the ${report.budgetBytes} byte budget).`;
    const warn = options.onWarning ?? console.warn;

    warn(warning);
  }

  if (report.cssBytes >= report.cssWarningThresholdBytes) {
    const warning =
      `CSS bundle is ${report.cssBytes} bytes ` +
      `(${report.cssBudgetUsagePercent}% of the ${report.cssBudgetBytes} byte budget).`;
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

function sumFilesByExtension(files: string[], extension: string) {
  return files
    .filter((filePath) => filePath.endsWith(extension))
    .reduce((total, filePath) => total + statSync(filePath).size, 0);
}

if (import.meta.main) {
  const report = checkBundleSize();

  console.log(
    `JavaScript bundle size ${report.jsBytes} bytes and CSS bundle size ${report.cssBytes} bytes are within budget.`,
  );
}
