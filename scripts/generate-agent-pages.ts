import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  generateCapabilityManifest,
  readRepositoryWorkflowSources,
} from "./generate-workflow-manifest.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const pagesBaseUrl = "https://moritzbrantner.github.io/reusable-workflows/";

mkdirSync(dist, { recursive: true });

const capabilities = generateCapabilityManifest(readRepositoryWorkflowSources());
const agentTool = {
  schemaVersion: 1,
  id: "reusable-workflows",
  kind: "static-workflow-capability-catalog",
  baseUrl: pagesBaseUrl,
  description:
    "Current callable GitHub workflow capabilities derived directly from workflow YAML on main.",
  operations: [
    {
      id: "capabilities",
      transport: "static-json",
      href: `${pagesBaseUrl}capabilities.json`,
      description:
        "Current workflow_call inputs, secrets, outputs, jobs, and permissions generated from .github/workflows/*.yml.",
    },
    {
      id: "reference-ui",
      transport: "html",
      href: pagesBaseUrl,
      description: "Human-readable workflow capability and adoption reference.",
    },
  ],
  sourceOfTruth: ".github/workflows/*.yml",
  compatibilityRelease: capabilities.compatibility_release,
  localFallback: ["bun run contracts:generate", "bun run validate:contracts"],
};

writeFileSync(path.join(dist, "capabilities.json"), `${JSON.stringify(capabilities, null, 2)}\n`);
writeFileSync(path.join(dist, "agent-tool.json"), `${JSON.stringify(agentTool, null, 2)}\n`);

console.log(
  `Published ${Object.keys(capabilities.workflows).length} callable workflow capabilities for agents.`,
);
