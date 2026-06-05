/* eslint-disable no-console */

import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const distDir = path.resolve("dist");
const budgetBytes = 350 * 1024;

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

if (jsBytes > budgetBytes) {
  throw new Error(`JavaScript bundle is ${jsBytes} bytes, above the ${budgetBytes} byte budget.`);
}

console.log(`JavaScript bundle size ${jsBytes} bytes is within the ${budgetBytes} byte budget.`);
