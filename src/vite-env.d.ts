/// <reference types="vite/client" />

declare module "virtual:workflow-catalog-data" {
  import type { ParsedJob } from "./app/types";

  const workflowCatalogData: Record<
    string,
    {
      jobs: ParsedJob[];
      triggers: string[];
      yamlName: string;
    }
  >;

  export default workflowCatalogData;
}
