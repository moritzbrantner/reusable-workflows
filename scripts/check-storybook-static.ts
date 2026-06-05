/* eslint-disable no-console */

import { existsSync } from "node:fs";

const requiredFiles = ["storybook-static/index.html", "storybook-static/index.json"];
const missingFiles = requiredFiles.filter((filePath) => !existsSync(filePath));

if (missingFiles.length > 0) {
  throw new Error(`Storybook build is missing: ${missingFiles.join(", ")}`);
}

console.log("Storybook static build contains the expected entrypoints.");
