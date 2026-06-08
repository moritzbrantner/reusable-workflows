import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type ContractField = {
  required?: boolean;
  type?: string;
  default?: unknown;
  description?: string;
};

export type WorkflowContract = {
  inputs: Record<string, ContractField>;
  secrets?: Record<string, { required?: boolean }>;
  outputs?: Record<string, { description?: string; value?: string }>;
  permissions: Record<string, string>;
};

export type WorkflowMetadata = {
  file: string;
  title: string;
  summary: string;
  role: "Reusable contract" | "Local caller";
  useWhen: string;
  responsibilities: string[];
  icon: LucideIcon;
};

export type ParsedJob = {
  id: string;
  name: string;
  uses?: string;
  usesWorkflow?: string;
  needs: string[];
  runsOn?: string;
  timeoutMinutes?: number;
  stepCount: number;
};

export type ParsedWorkflow = WorkflowMetadata & {
  slug: string;
  source: string;
  yamlName: string;
  triggers: string[];
  jobs: ParsedJob[];
  dependencies: string[];
  contract?: WorkflowContract;
  callers: string[];
};

export type MetricsChartSeriesId = "build" | "bundle" | "benchmark" | "lighthouse";

export type MetricsChartDatum = {
  completedLabel: string;
  raw: Record<MetricsChartSeriesId, string>;
  runLabel: string;
} & Partial<Record<MetricsChartSeriesId, number>>;

export type ChartLegendItem = {
  color?: string;
  description?: ReactNode;
  disabled?: boolean;
  id: string;
  label: ReactNode;
  meta?: ReactNode;
};
