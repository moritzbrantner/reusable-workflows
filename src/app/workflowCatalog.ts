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
  ServerCog,
  ShieldCheck,
  TestTube2,
  Workflow,
} from "lucide-react";

import workflowContracts from "../../contracts/workflows.json";
import type { ParsedJob, ParsedWorkflow, WorkflowContract, WorkflowMetadata } from "./types";
import workflowCatalogData from "virtual:workflow-catalog-data";

type WorkflowCatalogData = Record<
  string,
  {
    jobs: ParsedJob[];
    source: string;
    triggers: string[];
    yamlName: string;
  }
>;

const workflowsByFile = workflowCatalogData as WorkflowCatalogData;

const workflowDetails = [
  {
    file: ".github/workflows/validate.yml",
    title: "Validate",
    summary:
      "Main CI Caller Workflow that runs fast PR checks first and gates heavier validation behind main-branch pushes, manual dispatch, or PR labels.",
    role: "Caller Workflow",
    useWhen:
      "Use this local workflow as the repository-wide CI entrypoint for pull requests, main-branch pushes, and manual full validation.",
    responsibilities: [
      "Runs Fast Validation and actionlint as the default fail-fast gate.",
      "Runs e2e, Storybook, link, and performance jobs only after the fast gate passes.",
      "Supports manual dispatch inputs and PR labels for selectively enabling costly validation suites.",
      "Keeps CI concurrency scoped to the workflow and Git ref.",
    ],
    icon: Workflow,
  },
  {
    file: ".github/workflows/deploy-docs-pages.yml",
    title: "Deploy Docs Pages",
    summary:
      "Default-branch and manual Caller Workflow that builds the reference app and publishes it through the reusable Pages workflow.",
    role: "Caller Workflow",
    useWhen:
      "Use this Caller Workflow to publish the generated documentation site from `dist/` to GitHub Pages.",
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
      "Low-cost Caller Workflow that exercises the reusable workflow API with minimal shell commands.",
    role: "Caller Workflow",
    useWhen:
      "Use this workflow to catch Workflow Contract regressions in Reusable Workflows without running the full application test suite.",
    responsibilities: [
      "Runs automatically only when workflow API surface or contract-validation files change.",
      "Calls every reusable validation workflow with no-op or smoke commands after the fast smoke check passes.",
      "Verifies optional setup paths can be disabled for smoke runs.",
      "Keeps a manual dispatch path for explicit Reusable Workflow smoke coverage.",
    ],
    icon: ShieldCheck,
  },
  {
    file: ".github/workflows/fast-validation.yml",
    title: "Fast Validation",
    summary: "Thin generic adapter for one repository-owned validation command.",
    role: "Reusable Workflow",
    useWhen:
      "Use this workflow when a generic consumer needs GitHub to run an existing repository-owned command.",
    responsibilities: [
      "Installs the requested Bun and Node runtimes before running one caller-provided command.",
      "Leaves capability composition and tier/depth semantics in repository tooling.",
      "Keeps package registry access explicit through read-only package permissions and optional auth secrets.",
    ],
    icon: CheckCircle2,
  },
  {
    file: ".github/workflows/integration-validation.yml",
    title: "Integration Validation",
    summary: "Service checks, database checks, migrations, package checks, and integration suites.",
    role: "Reusable Workflow",
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
    role: "Reusable Workflow",
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
    role: "Reusable Workflow",
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
    role: "Reusable Workflow",
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
    role: "Reusable Workflow",
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
    role: "Reusable Workflow",
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
    file: ".github/workflows/external-pull.yml",
    title: "External Pull",
    summary: "External server trigger for pulling the current repository ref and SHA.",
    role: "Reusable Workflow",
    useWhen:
      "Use this workflow when a repository should notify an external deployment host to pull the current version.",
    responsibilities: [
      "Posts repository, ref, SHA, run, actor, and event metadata to a secret endpoint.",
      "Authenticates with an explicit bearer token secret instead of forwarding the GitHub token.",
      "Retries transient request failures and fails unless the server returns a 2xx response.",
    ],
    icon: ServerCog,
  },
  {
    file: ".github/workflows/package-publish.yml",
    title: "Package Publish",
    summary:
      "Opinionated npm-compatible registry and Cargo package publishing with explicit publish gating.",
    role: "Reusable Workflow",
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
    role: "Reusable Workflow",
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
    summary:
      "Specialized legacy adapter for consumers with an existing stage/branch command model.",
    role: "Reusable Workflow",
    useWhen:
      "Use this workflow only when an existing consumer genuinely needs a stage/branch command selector.",
    responsibilities: [
      "Maps the requested stage to develop, nightly, beta, staging, or production commands.",
      "Preserves an existing specialized interface rather than defining the preferred lifecycle model.",
      "Supports artifacts for stage checks that produce diagnostics.",
    ],
    icon: GitBranch,
  },
  {
    file: ".github/workflows/promote-branches.yml",
    title: "Promote Branches",
    summary: "Exact tested SHA promotion between branches with force-with-lease safeguards.",
    role: "Reusable Workflow",
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
    role: "Reusable Workflow",
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
    description: "PR and push Caller Workflow for the app validation path.",
    group: "Caller Workflow",
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
    description: "Default-branch and manual Pages deployment Caller Workflow.",
    group: "Caller Workflow",
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
    description: "Smoke Caller Workflow that exercises Reusable Workflows with minimal commands.",
    group: "Caller Workflow",
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
    description: "Thin generic adapter for one repository-owned validation command.",
    group: "Reusable Workflow",
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
    group: "Reusable Workflow",
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
    group: "Reusable Workflow",
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
    group: "Reusable Workflow",
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
    group: "Reusable Workflow",
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
    group: "Reusable Workflow",
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
    description: "Specialized legacy stage/branch command selector.",
    group: "Reusable Workflow",
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
    group: "Reusable Workflow",
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
    group: "Reusable Workflow",
    x: 664,
    y: 504,
    width: 208,
    height: 112,
    tone: "success",
    status: "stable",
  },
  {
    id: "external-pull",
    label: "External Pull",
    description: "External server notification for pulling the current ref.",
    group: "Reusable Workflow",
    version: "No caller workflow",
    x: 1008,
    y: 504,
    width: 208,
    height: 112,
    tone: "muted",
    status: "stable",
  },
  {
    id: "release-template",
    label: "Release Template",
    description: "Validate, build, publish, and upload release artifacts.",
    group: "Reusable Workflow",
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
    group: "Reusable Workflow",
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
    group: "Reusable Workflow",
    version: "No caller workflow",
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
  const workflowsWithoutCallers = Object.entries(workflowsByFile)
    .map(([file, workflow]) => parseWorkflow(file, workflow))
    .sort((first, second) => {
      if (first.role !== second.role) {
        return first.role === "Reusable Workflow" ? -1 : 1;
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

function parseWorkflow(
  file: string,
  workflow: WorkflowCatalogData[string],
): Omit<ParsedWorkflow, "callers"> {
  const metadata = workflowMetadataByFile.get(file) ?? fallbackWorkflowMetadata(file);

  return {
    ...metadata,
    slug: slugFromFile(file),
    source: workflow.source,
    yamlName: workflow.yamlName || metadata.title,
    triggers: workflow.triggers,
    jobs: workflow.jobs,
    dependencies: Array.from(new Set(workflow.jobs.flatMap((job) => job.usesWorkflow ?? []))),
    contract: contracts[file],
  };
}

export function workflowInputMetrics(workflows: ParsedWorkflow[]) {
  const reusableWorkflows = workflows.filter((workflow) => workflow.role === "Reusable Workflow");
  const inputNames = new Set<string>();

  const totalInputSlots = reusableWorkflows.reduce((count, workflow) => {
    const names = Object.keys(workflow.contract?.inputs ?? {});

    for (const name of names) {
      inputNames.add(name);
    }

    return count + names.length;
  }, 0);

  return {
    totalInputSlots,
    uniqueInputNames: inputNames.size,
  };
}

function fallbackWorkflowMetadata(file: string): WorkflowMetadata {
  const title = titleFromSlug(slugFromFile(file));

  return {
    file,
    title,
    summary: `Workflow documentation for ${file}.`,
    role: contracts[file] ? "Reusable Workflow" : "Caller Workflow",
    useWhen: `Use this workflow when ${title.toLowerCase()} is the appropriate repository automation entrypoint.`,
    responsibilities: ["Review the workflow source for repository-specific responsibilities."],
    icon: Workflow,
  };
}

export function buildUsageSnippet(workflow: ParsedWorkflow) {
  if (workflow.role === "Caller Workflow") {
    return `# ${workflow.file}
# This workflow is a Caller Workflow.
# It invokes:
${workflow.dependencies.map((dependency) => `# - ${dependency}`).join("\n") || "# - no invoked Reusable Workflows"}`;
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
