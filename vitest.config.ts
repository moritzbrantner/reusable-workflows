import { defineConfig } from "vitest/config";

import { workflowCatalogDataPlugin } from "./scripts/workflow-catalog-plugin";

export default defineConfig({
  plugins: [workflowCatalogDataPlugin(import.meta.dirname)],
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
