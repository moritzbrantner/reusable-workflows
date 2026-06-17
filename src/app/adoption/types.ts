export type AdoptionProfileId =
  | "web-app"
  | "monorepo-web-app"
  | "component-library"
  | "package"
  | "pages-site";

export type PackageManager = "bun" | "npm" | "pnpm";

export type AdoptionOptions = {
  profileId: AdoptionProfileId;
  packageManager: PackageManager;
  workflowRef: string;
  workingDirectory: string;
  includeE2e: boolean;
  includeLinks: boolean;
  includePerformance: boolean;
  includePagesDeploy: boolean;
  includePackagePublish: boolean;
};

type AdoptionDiagnosticLevel = "warning" | "error";

export type AdoptionDiagnostic = {
  code: string;
  level: AdoptionDiagnosticLevel;
  message: string;
  file?: string;
  line?: number;
};

export type AdoptionProfile = {
  description: string;
  id: AdoptionProfileId;
  label: string;
  options: AdoptionOptions;
};

export type GeneratedWorkflow = {
  content: string;
  path: string;
};

export type AdoptionCheckResult = {
  diagnostics: AdoptionDiagnostic[];
};
