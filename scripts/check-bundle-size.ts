/* eslint-disable no-console */

import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const distDir = path.resolve("dist");
const budgetBytes = 375 * 1024;

function collectFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const entryPath = path.join(dir, entry);
    return statSync(entryPath).isDirectory() ? collectFiles(entryPath) : [entryPath];
  });
}

const files = collectFiles(distDir);
const jsBytes = files
  .filter((filePath) => filePath.endsWith(".js"))
  .reduce((total, filePath) => total + statSync(filePath).size, 0);
const withinBudget = jsBytes <= budgetBytes;

mkdirSync("performance-results", { recursive: true });
writeFileSync(
  "performance-results/bundle-size.json",
  `${JSON.stringify(
    {
      jsBytes,
      budgetBytes,
      withinBudget,
    },
    null,
    2,
  )}\n`,
);

if (!withinBudget) {
  throw new Error(`JavaScript bundle is ${jsBytes} bytes, above the ${budgetBytes} byte budget.`);
}

console.log(`JavaScript bundle size ${jsBytes} bytes is within the ${budgetBytes} byte budget.`);
