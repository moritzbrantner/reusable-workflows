import {
  BookOpen,
  CheckCircle2,
  GitBranch,
  GitPullRequestArrow,
  Gauge,
  Globe2,
  Layers3,
  Link as LinkIcon,
  PackageCheck,
  Rocket,
  ShieldCheck,
  TestTube2,
  Workflow,
} from "lucide-react";

import workflowContracts from "../../contracts/workflows.json";
import type { ParsedJob, ParsedWorkflow, WorkflowContract, WorkflowMetadata } from "./types";

const workflowSources = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>("../../.github/workflows/*.yml", {
      eager: true,
      import: "default",
      query: "?raw",
    }),
  ).map(([file, source]) => [file.replace("../../", ""), source]),
) as Record<string, string>;

const workflowDetails = [
  {
    file: ".github/workflows/validate.yml",
    title: "Validate",
    summary:
      "Main PR and push caller that fans out into fast, integration, e2e, docs, link, performance, stage, compatibility, and actionlint checks.",
    role: "Local caller",
    useWhen:
      "Use this local workflow as the repository-wide CI entrypoint for pushes and pull requests.",
    responsibilities: [
      "Calls the reusable validation workflows with this app's concrete Bun, Playwright, contract, and build commands.",
      "Runs actionlint over every workflow file after reusable workflow checks are configured.",
      "Keeps CI concurrency scoped to the workflow and Git ref.",
    ],
    icon: Workflow,
  },
  {
    file: ".github/workflows/deploy-docs-pages.yml",
    title: "Deploy Docs Pages",
    summary:
      "Default-branch and manual caller that builds the reference app and publishes it through the reusable Pages workflow.",
    role: "Local caller",
    useWhen:
      "Use this caller to publish the generated documentation site from `dist/` to GitHub Pages.",
    responsibilities: [
      "Runs on `main` pushes and manual dispatches.",
      "Delegates build, artifact upload, and Pages deployment to `deploy-pages.yml`.",
      "Grants Pages and OIDC permissions only for the deployment path.",
    ],
    icon: Globe2,
  },
  {
    file: ".github/workflows/smoke-reusable-workflows.yml",
    title: "Smoke Reusable Workflows",
    summary:
      "Low-cost caller that exercises the reusable workflow API with minimal shell commands.",
    role: "Local caller",
    useWhen:
      "Use this workflow to catch contract regressions in reusable workflows without running the full application test suite.",
    responsibilities: [
      "Calls every reusable validation workflow with no-op or smoke commands.",
      "Verifies optional setup paths can be disabled for smoke runs.",
      "Exercises release and permissions-sensitive workflows with repository-local inputs.",
    ],
    icon: ShieldCheck,
  },
  {
    file: ".github/workflows/fast-validation.yml",
    title: "Fast Validation",
    summary: "Formatting, linting, typechecking, builds, and unit tests for tight PR feedback.",
    role: "Reusable contract",
    useWhen: "Use this workflow for the checks that should complete first on every pull request.",
    responsibilities: [
      "Installs Bun, Node, and optional Cargo cache paths as requested by inputs.",
      "Runs format, lint, typecheck, build, unit test, pre, and post commands when provided.",
      "Keeps package registry access explicit through read-only package permissions and optional auth secrets.",
    ],
    icon: CheckCircle2,
  },
  {
    file: ".github/workflows/integration-validation.yml",
    title: "Integration Validation",
    summary: "Service checks, database checks, migrations, package checks, and integration suites.",
    role: "Reusable contract",
    useWhen:
      "Use this workflow when validation needs external services, migration checks, or heavier package verification.",
    responsibilities: [
      "Runs integration, migration, service health, and package check commands in a controlled order.",
      "Can upload artifacts for failed or requested integration outputs.",
      "Supports the same Bun, Node, Cargo, and package-auth setup surface as the fast path.",
    ],
    icon: Layers3,
  },
  {
    file: ".github/workflows/e2e-validation.yml",
    title: "E2E Validation",
    summary: "Browser, Playwright, Electron, Tauri, mobile, and artifact-backed e2e runs.",
    role: "Reusable contract",
    useWhen:
      "Use this workflow for browser or app-level tests that need a build step and failure artifacts.",
    responsibilities: [
      "Optionally installs Playwright browsers and xvfb before running the e2e command.",
      "Supports build, pre, e2e, and post commands around the test run.",
      "Uploads Playwright reports, test results, or caller-provided paths according to the artifact policy.",
    ],
    icon: TestTube2,
  },
  {
    file: ".github/workflows/storybook-validation.yml",
    title: "Storybook Validation",
    summary: "Storybook builds, interaction tests, accessibility checks, and visual validation.",
    role: "Reusable contract",
    useWhen:
      "Use this workflow when component documentation and browser-level component checks are part of CI.",
    responsibilities: [
      "Builds Storybook and runs optional Storybook test, accessibility, and visual commands.",
      "Can install Playwright for browser-backed component checks.",
      "Uploads Storybook and browser artifacts when callers request or failures occur.",
    ],
    icon: BookOpen,
  },
  {
    file: ".github/workflows/link-validation.yml",
    title: "Link Validation",
    summary: "Local or deployed site crawling for broken links, assets, and fragment anchors.",
    role: "Reusable contract",
    useWhen:
      "Use this workflow after a site build when broken links or fragment anchors need automated coverage.",
    responsibilities: [
      "Builds and optionally starts a local preview server before crawling.",
      "Passes the target URL to caller-provided link checking commands.",
      "Captures link checking reports as artifacts when configured.",
    ],
    icon: LinkIcon,
  },
  {
    file: ".github/workflows/performance-validation.yml",
    title: "Performance Validation",
    summary: "Unlighthouse, benchmarks, bundle size checks, API reports, and heavier suites.",
    role: "Reusable contract",
    useWhen:
      "Use this workflow for checks that are valuable but slower than ordinary PR validation.",
    responsibilities: [
      "Runs performance build, Unlighthouse, benchmark, bundle size, and API report commands when supplied.",
      "Publishes benchmark and build-metric summaries into the GitHub Actions step summary.",
      "Uploads performance reports, normalized metrics JSON, and configured result directories.",
    ],
    icon: Gauge,
  },
  {
    file: ".github/workflows/deploy-pages.yml",
    title: "Deploy Pages",
    summary: "GitHub Pages configuration, artifact upload, deployment, and page_url output.",
    role: "Reusable contract",
    useWhen:
      "Use this workflow when a repository needs a standard GitHub Pages deployment after a build.",
    responsibilities: [
      "Prepares package-manager caches and runs caller-provided pre, install, and build commands.",
      "Uploads the requested artifact directory as a Pages artifact.",
      "Deploys to GitHub Pages and exposes the resulting `page_url` output.",
    ],
    icon: Globe2,
  },
  {
    file: ".github/workflows/package-publish.yml",
    title: "Package Publish",
    summary:
      "Opinionated npm-compatible registry and Cargo package publishing with explicit publish gating.",
    role: "Reusable contract",
    useWhen:
      "Use this workflow for standard npm or Cargo package publication from tag, release, or manual publish callers.",
    responsibilities: [
      "Validates the selected package manager and only publishes when `publish_enabled` is true.",
      "Sets up npm or Cargo-specific tooling, caching, registry authentication, and default publish flags.",
      "Keeps package publishing separate from custom app release flows handled by `release-template.yml`.",
    ],
    icon: PackageCheck,
  },
  {
    file: ".github/workflows/release-template.yml",
    title: "Release Template",
    summary: "Validate, build, publish, and upload release artifacts with explicit secrets.",
    role: "Reusable contract",
    useWhen:
      "Use this workflow as a reusable release skeleton where each repository supplies its own publish command.",
    responsibilities: [
      "Runs validate, build, and release commands with optional package-manager authentication.",
      "Separates release token handling from ordinary validation secrets.",
      "Uploads release artifacts when a caller provides artifact paths.",
    ],
    icon: Rocket,
  },
  {
    file: ".github/workflows/stage-validation.yml",
    title: "Stage Validation",
    summary: "Stage-specific branch checks for develop, nightly, beta, staging, and production.",
    role: "Reusable contract",
    useWhen:
      "Use this workflow when branch or deployment stage should select a different validation command.",
    responsibilities: [
      "Maps the requested stage to develop, nightly, beta, staging, or production commands.",
      "Keeps stage-specific validation in one reusable contract.",
      "Supports artifacts for stage checks that produce diagnostics.",
    ],
    icon: GitBranch,
  },
  {
    file: ".github/workflows/promote-branches.yml",
    title: "Promote Branches",
    summary: "Exact tested SHA promotion between branches with force-with-lease safeguards.",
    role: "Reusable contract",
    useWhen:
      "Use this workflow to promote a known tested commit from one maintained branch to another.",
    responsibilities: [
      "Checks out an explicit source ref and verifies the target branch before promotion.",
      "Pushes with force-with-lease instead of blind force pushes.",
      "Allows repositories to centralize branch promotion policy while keeping the promoted SHA visible.",
    ],
    icon: GitPullRequestArrow,
  },
  {
    file: ".github/workflows/validate-repo.yml",
    title: "Validate Repo",
    summary: "Compatibility workflow for existing scaffold-v2 repositories during migration.",
    role: "Reusable contract",
    useWhen:
      "Use this workflow for repositories that still expect the older combined validation surface.",
    responsibilities: [
      "Preserves compatibility for callers that pass format, lint, typecheck, test, build, and e2e commands in one workflow.",
      "Provides optional Playwright installation and artifact upload behavior.",
      "Lets repositories migrate toward smaller workflows without breaking existing callers immediately.",
    ],
    icon: PackageCheck,
  },
] as const satisfies readonly WorkflowMetadata[];

const workflowGraphNodes = [
  {
    id: "validate",
    label: "Validate",
    description: "PR and push caller for the app validation path.",
    group: "Caller",
    x: 0,
    y: 168,
    width: 216,
    height: 112,
    tone: "accent",
    status: "active",
  },
  {
    id: "deploy-docs-pages",
    label: "Deploy Docs Pages",
    description: "Default-branch and manual Pages deployment caller.",
    group: "Caller",
    x: 0,
    y: 464,
    width: 216,
    height: 112,
    tone: "accent",
    status: "active",
  },
  {
    id: "smoke",
    label: "Smoke Reusable Workflows",
    description: "Smoke caller that exercises reusable contracts with minimal commands.",
    group: "Caller",
    x: 0,
    y: 760,
    width: 216,
    height: 112,
    tone: "accent",
    status: "active",
  },
  {
    id: "fast-validation",
    label: "Fast Validation",
    description: "Format, lint, typecheck, build, and unit tests.",
    group: "Reusable contract",
    x: 320,
    y: 0,
    width: 208,
    height: 112,
    tone: "success",
    status: "stable",
  },
  {
    id: "integration-validation",
    label: "Integration Validation",
    description: "Services, migrations, packages, and integration suites.",
    group: "Reusable contract",
    x: 320,
    y: 136,
    width: 208,
    height: 112,
    tone: "success",
    status: "stable",
  },
  {
    id: "e2e-validation",
    label: "E2E Validation",
    description: "Browser, desktop, mobile, and artifact-backed e2e runs.",
    group: "Reusable contract",
    x: 320,
    y: 272,
    width: 208,
    height: 112,
    tone: "success",
    status: "stable",
  },
  {
    id: "storybook-validation",
    label: "Storybook Validation",
    description: "Storybook, interaction, accessibility, and visual checks.",
    group: "Reusable contract",
    x: 320,
    y: 408,
    width: 208,
    height: 112,
    tone: "success",
    status: "stable",
  },
  {
    id: "link-validation",
    label: "Link Validation",
    description: "Site crawling for routes, assets, and fragment anchors.",
    group: "Reusable contract",
    x: 320,
    y: 544,
    width: 208,
    height: 112,
    tone: "success",
    status: "stable",
  },
  {
    id: "performance-validation",
    label: "Performance Validation",
    description: "Unlighthouse, benchmarks, bundle size, and API reports.",
    group: "Reusable contract",
    x: 320,
    y: 680,
    width: 208,
    height: 112,
    tone: "success",
    status: "stable",
  },
  {
    id: "stage-validation",
    label: "Stage Validation",
    description: "Branch-stage checks for develop through production.",
    group: "Reusable contract",
    x: 664,
    y: 136,
    width: 208,
    height: 112,
    tone: "warning",
    status: "stable",
  },
  {
    id: "validate-repo",
    label: "Validate Repo",
    description: "Compatibility path for existing scaffold-v2 callers.",
    group: "Reusable contract",
    x: 664,
    y: 320,
    width: 208,
    height: 112,
    tone: "warning",
    status: "stable",
  },
  {
    id: "deploy-pages",
    label: "Deploy Pages",
    description: "Build artifact upload and GitHub Pages deployment.",
    group: "Reusable contract",
    x: 664,
    y: 504,
    width: 208,
    height: 112,
    tone: "success",
    status: "stable",
  },
  {
    id: "release-template",
    label: "Release Template",
    description: "Validate, build, publish, and upload release artifacts.",
    group: "Reusable contract",
    x: 664,
    y: 688,
    width: 208,
    height: 112,
    tone: "warning",
    status: "stable",
  },
  {
    id: "package-publish",
    label: "Package Publish",
    description: "npm and Cargo package publication with explicit gating.",
    group: "Reusable contract",
    x: 1008,
    y: 688,
    width: 208,
    height: 112,
    tone: "success",
    status: "stable",
  },
  {
    id: "promote-branches",
    label: "Promote Branches",
    description: "Exact tested SHA promotion between maintained branches.",
    group: "Reusable contract",
    version: "No local caller",
    x: 1008,
    y: 320,
    width: 208,
    height: 112,
    tone: "muted",
    status: "stable",
  },
] as const;

const workflowGraphEdges = [
  { id: "validate-fast", source: "validate", target: "fast-validation", label: "uses" },
  {
    id: "validate-integration",
    source: "validate",
    target: "integration-validation",
    label: "uses",
  },
  { id: "validate-e2e", source: "validate", target: "e2e-validation", label: "uses" },
  {
    id: "validate-storybook",
    source: "validate",
    target: "storybook-validation",
    label: "uses",
  },
  { id: "validate-link", source: "validate", target: "link-validation", label: "uses" },
  {
    id: "validate-performance",
    source: "validate",
    target: "performance-validation",
    label: "uses",
  },
  { id: "validate-stage", source: "validate", target: "stage-validation", label: "uses" },
  { id: "validate-compat", source: "validate", target: "validate-repo", label: "uses" },
  {
    id: "deploy-docs-pages-deploy",
    source: "deploy-docs-pages",
    target: "deploy-pages",
    label: "publishes through",
    kind: "build",
  },
  {
    id: "smoke-fast",
    source: "smoke",
    target: "fast-validation",
    label: "smoke",
    kind: "optional",
  },
  {
    id: "smoke-integration",
    source: "smoke",
    target: "integration-validation",
    label: "smoke",
    kind: "optional",
  },
  {
    id: "smoke-e2e",
    source: "smoke",
    target: "e2e-validation",
    label: "smoke",
    kind: "optional",
  },
  {
    id: "smoke-storybook",
    source: "smoke",
    target: "storybook-validation",
    label: "smoke",
    kind: "optional",
  },
  {
    id: "smoke-link",
    source: "smoke",
    target: "link-validation",
    label: "smoke",
    kind: "optional",
  },
  {
    id: "smoke-performance",
    source: "smoke",
    target: "performance-validation",
    label: "smoke",
    kind: "optional",
  },
  {
    id: "smoke-stage",
    source: "smoke",
    target: "stage-validation",
    label: "smoke",
    kind: "optional",
  },
  {
    id: "smoke-compat",
    source: "smoke",
    target: "validate-repo",
    label: "smoke",
    kind: "optional",
  },
  {
    id: "smoke-release",
    source: "smoke",
    target: "release-template",
    label: "smoke",
    kind: "optional",
  },
  {
    id: "smoke-package-publish",
    source: "smoke",
    target: "package-publish",
    label: "smoke",
    kind: "optional",
  },
] as const;

const contracts = workflowContracts.workflows as Record<string, WorkflowContract>;
const workflowMetadataByFile: ReadonlyMap<string, WorkflowMetadata> = new Map(
  workflowDetails.map((workflow) => [workflow.file, workflow]),
);

const workflows = buildParsedWorkflows();

export const parsedWorkflows = workflows;
export const parsedWorkflowsByFile = new Map(
  workflows.map((workflow) => [workflow.file, workflow]),
);
export const parsedWorkflowsBySlug = new Map(
  workflows.map((workflow) => [workflow.slug, workflow]),
);
export { workflowGraphEdges, workflowGraphNodes };

function buildParsedWorkflows() {
  const workflowsWithoutCallers = Object.entries(workflowSources)
    .map(([file, source]) => parseWorkflow(file, source))
    .sort((first, second) => {
      if (first.role !== second.role) {
        return first.role === "Reusable contract" ? -1 : 1;
      }

      return first.title.localeCompare(second.title);
    });
  const callersByFile = new Map<string, string[]>();

  for (const workflow of workflowsWithoutCallers) {
    for (const dependency of workflow.dependencies) {
      const callers = callersByFile.get(dependency) ?? [];
      callers.push(workflow.file);
      callersByFile.set(dependency, callers);
    }
  }

  return workflowsWithoutCallers.map((workflow) =>
    Object.assign(workflow, { callers: callersByFile.get(workflow.file)?.sort() ?? [] }),
  );
}

function parseWorkflow(file: string, source: string): Omit<ParsedWorkflow, "callers"> {
  const metadata = workflowMetadataByFile.get(file) ?? fallbackWorkflowMetadata(file);
  const jobs = parseWorkflowJobs(source);

  return {
    ...metadata,
    slug: slugFromFile(file),
    source,
    yamlName: parseWorkflowName(source) ?? metadata.title,
    triggers: parseWorkflowTriggers(source),
    jobs,
    dependencies: Array.from(new Set(jobs.flatMap((job) => job.usesWorkflow ?? []))),
    contract: contracts[file],
  };
}

function fallbackWorkflowMetadata(file: string): WorkflowMetadata {
  const title = titleFromSlug(slugFromFile(file));

  return {
    file,
    title,
    summary: `Workflow documentation for ${file}.`,
    role: contracts[file] ? "Reusable contract" : "Local caller",
    useWhen: `Use this workflow when ${title.toLowerCase()} is the appropriate repository automation entrypoint.`,
    responsibilities: ["Review the workflow source for repository-specific responsibilities."],
    icon: Workflow,
  };
}

function normalizeWorkflowRef(ref: string) {
  const refWithoutVersion = ref.split("@")[0];
  const workflowIndex = refWithoutVersion.indexOf(".github/workflows/");

  return workflowIndex >= 0 ? refWithoutVersion.slice(workflowIndex) : undefined;
}

function parseWorkflowName(source: string) {
  const name = source.match(/^name:\s*(.+)$/m)?.[1];

  return name ? unquoteYamlScalar(name) : undefined;
}

function parseWorkflowTriggers(source: string) {
  const onBlock = getTopLevelBlock(source, "on");

  if (!onBlock) {
    return ["workflow_call"];
  }

  if (onBlock.headerValue) {
    return parseYamlStringList(onBlock.headerValue);
  }

  const triggers = onBlock.lines.flatMap((line) => {
    const match = line.match(/^  ([\w-]+):/);

    return match ? [match[1]] : [];
  });

  return triggers.length > 0 ? triggers : ["workflow_call"];
}

function parseWorkflowJobs(source: string): ParsedJob[] {
  const jobsBlock = getTopLevelBlock(source, "jobs");

  if (!jobsBlock) {
    return [];
  }

  const jobs: ParsedJob[] = [];
  const lines = jobsBlock.lines;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const jobMatch = lines[lineIndex].match(/^  ([\w-]+):\s*$/);

    if (!jobMatch) {
      continue;
    }

    const id = jobMatch[1];
    const jobLines: string[] = [];

    lineIndex += 1;
    while (lineIndex < lines.length && !/^  [\w-]+:\s*$/.test(lines[lineIndex])) {
      jobLines.push(lines[lineIndex]);
      lineIndex += 1;
    }
    lineIndex -= 1;

    const uses = findYamlProperty(jobLines, "uses");
    const timeoutMinutes = Number(findYamlProperty(jobLines, "timeout-minutes"));

    jobs.push({
      id,
      name: findYamlProperty(jobLines, "name") ?? titleFromSlug(id),
      uses,
      usesWorkflow: uses ? normalizeWorkflowRef(uses) : undefined,
      needs: parseYamlStringList(findYamlProperty(jobLines, "needs") ?? ""),
      runsOn: findYamlProperty(jobLines, "runs-on"),
      timeoutMinutes: Number.isFinite(timeoutMinutes) ? timeoutMinutes : undefined,
      stepCount: countWorkflowSteps(jobLines),
    });
  }

  return jobs;
}

function getTopLevelBlock(source: string, key: string) {
  const lines = source.split("\n");
  const blockStart = lines.findIndex((line) => line.startsWith(`${key}:`));

  if (blockStart < 0) {
    return undefined;
  }

  const headerValue = lines[blockStart].slice(key.length + 1).trim();
  const blockLines: string[] = [];

  for (let lineIndex = blockStart + 1; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];

    if (/^\S/.test(line)) {
      break;
    }

    blockLines.push(line);
  }

  return { headerValue, lines: blockLines };
}

function findYamlProperty(lines: string[], key: string) {
  const propertyLine = lines.find((line) => line.startsWith(`    ${key}:`));
  const value = propertyLine?.slice(key.length + 5).trim();

  return value ? unquoteYamlScalar(value) : undefined;
}

function countWorkflowSteps(lines: string[]) {
  const stepsIndex = lines.findIndex((line) => line === "    steps:");

  if (stepsIndex < 0) {
    return 0;
  }

  let stepCount = 0;

  for (let lineIndex = stepsIndex + 1; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];

    if (/^    \S/.test(line)) {
      break;
    }

    if (line.startsWith("      - ")) {
      stepCount += 1;
    }
  }

  return stepCount;
}

function parseYamlStringList(value: string) {
  const normalized = unquoteYamlScalar(value);

  if (!normalized) {
    return [];
  }

  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    return normalized
      .slice(1, -1)
      .split(",")
      .map((item) => unquoteYamlScalar(item.trim()))
      .filter(Boolean);
  }

  return [normalized];
}

function unquoteYamlScalar(value: string) {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

export function buildUsageSnippet(workflow: ParsedWorkflow) {
  if (workflow.role === "Local caller") {
    return `# ${workflow.file}
# This workflow is a repository-local caller.
# It invokes:
${workflow.dependencies.map((dependency) => `# - ${dependency}`).join("\n") || "# - no local reusable workflows"}`;
  }

  const contractInputs = Object.entries(workflow.contract?.inputs ?? {})
    .filter(([, input]) => input.required || typeof input.default === "string")
    .slice(0, 6);
  const inputLines = contractInputs.length
    ? contractInputs
        .map(([name, input]) => `      ${name}: ${formatYamlExampleValue(input.default ?? "")}`)
        .join("\n")
    : "      # pass workflow-specific inputs here";

  return `jobs:
  ${workflow.slug}:
    permissions:
${Object.entries(workflow.contract?.permissions ?? { contents: "read" })
  .map(([permission, access]) => `      ${permission}: ${access}`)
  .join("\n")}
    uses: moritzbrantner/reusable-workflows/${workflow.file}@${workflowContracts.workflow_standard}
    with:
${inputLines}`;
}

function formatYamlExampleValue(value: unknown) {
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }

  return JSON.stringify(value);
}

function slugFromFile(file: string) {
  return (
    file
      .split("/")
      .at(-1)
      ?.replace(/\.ya?ml$/, "") ?? file
  );
}

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
