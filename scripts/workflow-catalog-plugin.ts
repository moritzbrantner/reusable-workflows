import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type { Plugin } from "vite";

import { parseWorkflowForCatalog } from "./workflow-catalog-data";

const virtualModuleId = "virtual:workflow-catalog-data";
const resolvedVirtualModuleId = `\0${virtualModuleId}`;

export function workflowCatalogDataPlugin(rootDir = process.cwd()): Plugin {
  return {
    name: "workflow-catalog-data",
    resolveId(id) {
      return id === virtualModuleId ? resolvedVirtualModuleId : undefined;
    },
    load(id) {
      if (id !== resolvedVirtualModuleId) {
        return undefined;
      }

      const workflowsDir = path.resolve(rootDir, ".github", "workflows");
      const workflowFileNames = readdirSync(workflowsDir)
        .filter((fileName) => fileName.endsWith(".yml"))
        .sort();
      const workflowData = Object.fromEntries(
        workflowFileNames.map((fileName) => {
          const file = `.github/workflows/${fileName}`;
          const workflowPath = path.join(workflowsDir, fileName);
          const source = readFileSync(workflowPath, "utf8");

          this.addWatchFile(workflowPath);

          return [file, parseWorkflowForCatalog(source)];
        }),
      );

      return `export default ${JSON.stringify(workflowData)};`;
    },
  };
}
