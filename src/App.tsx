import { type HTMLAttributes, type ReactNode, useCallback, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Boxes,
  Braces,
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
import type { LucideIcon } from "lucide-react";

import type { BuildMetricsHistory } from "./build-metrics";
import buildMetricsHistoryJson from "./generated/build-metrics-history.json";
import workflowContracts from "../contracts/workflows.json";

type ContractField = {
  required?: boolean;
  type?: string;
  default?: unknown;
  description?: string;
};

type WorkflowContract = {
  inputs: Record<string, ContractField>;
  secrets?: Record<string, { required?: boolean }>;
  outputs?: Record<string, { description?: string; value?: string }>;
  permissions: Record<string, string>;
};

type WorkflowMetadata = {
  file: string;
  title: string;
  summary: string;
  role: "Reusable contract" | "Local caller";
  useWhen: string;
  responsibilities: string[];
  icon: LucideIcon;
};

type ParsedJob = {
  id: string;
  name: string;
  uses?: string;
  usesWorkflow?: string;
  needs: string[];
  runsOn?: string;
  timeoutMinutes?: number;
  stepCount: number;
};

type ParsedWorkflow = WorkflowMetadata & {
  slug: string;
  source: string;
  yamlName: string;
  triggers: string[];
  jobs: ParsedJob[];
  dependencies: string[];
  contract?: WorkflowContract;
  callers: string[];
};

type MetricsChartSeriesId = "build" | "bundle" | "benchmark" | "lighthouse";

type MetricsChartDatum = {
  completedLabel: string;
  raw: Record<MetricsChartSeriesId, string>;
  runLabel: string;
} & Partial<Record<MetricsChartSeriesId, number>>;

type ChartLegendItem = {
  color?: string;
  description?: ReactNode;
  disabled?: boolean;
  id: string;
  label: ReactNode;
  meta?: ReactNode;
};

const metricsChartSeries: Array<{
  color: string;
  id: MetricsChartSeriesId;
  label: string;
}> = [
  { color: "#166534", id: "build", label: "Build duration" },
  { color: "#2563eb", id: "bundle", label: "JS bundle" },
  { color: "#c2410c", id: "benchmark", label: "Benchmark ops/s" },
  { color: "#7c3aed", id: "lighthouse", label: "Lighthouse score" },
];

declare global {
  interface Window {
    buildMetricsHistoryFixture?: BuildMetricsHistory;
  }
}

const workflowSources = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>("../.github/workflows/*.yml", {
      eager: true,
      import: "default",
      query: "?raw",
    }),
  ).map(([file, source]) => [file.replace("../", ""), source]),
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
] as const;

const contracts = workflowContracts.workflows as Record<string, WorkflowContract>;
const workflowMetadataByFile: ReadonlyMap<string, WorkflowMetadata> = new Map(
  workflowDetails.map((workflow) => [workflow.file, workflow]),
);

const parsedWorkflows = buildParsedWorkflows();
const parsedWorkflowsByFile = new Map(parsedWorkflows.map((workflow) => [workflow.file, workflow]));
const parsedWorkflowsBySlug = new Map(parsedWorkflows.map((workflow) => [workflow.slug, workflow]));
const buildMetricsHistory = getBuildMetricsHistory();

function App() {
  const selectedSlug = typeof window === "undefined" ? "" : slugFromPath(window.location.pathname);
  const selectedWorkflow = selectedSlug ? parsedWorkflowsBySlug.get(selectedSlug) : undefined;

  if (selectedWorkflow) {
    return <WorkflowPage workflow={selectedWorkflow} />;
  }

  return <HomePage />;
}

function getBuildMetricsHistory(): BuildMetricsHistory {
  if (typeof window !== "undefined" && window.buildMetricsHistoryFixture) {
    return window.buildMetricsHistoryFixture;
  }

  return buildMetricsHistoryJson as BuildMetricsHistory;
}

function HomePage() {
  const reusableWorkflows = parsedWorkflows.filter(
    (workflow) => workflow.role === "Reusable contract",
  );
  const callerWorkflows = parsedWorkflows.filter((workflow) => workflow.role === "Local caller");
  const totalInputs = reusableWorkflows.reduce(
    (count, workflow) => count + Object.keys(workflow.contract?.inputs ?? {}).length,
    0,
  );
  const outputCount = reusableWorkflows.filter(
    (workflow) => Object.keys(workflow.contract?.outputs ?? {}).length > 0,
  ).length;

  return (
    <>
      <SiteHeader />

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__content">
            <p className="eyebrow">{workflowContracts.workflow_standard}</p>
            <h1 id="hero-title">Shared CI and release contracts for maintained repos.</h1>
            <p className="hero__lede">
              A React-built reference for the reusable GitHub Actions workflows that power
              validation, deployment, release, stage, and compatibility flows across the repo
              family.
            </p>
            <div className="hero__actions" aria-label="Repository resources">
              <a
                className="button button--primary"
                href="https://github.com/moritzbrantner/reusable-workflows"
              >
                <Boxes aria-hidden="true" />
                Repository
              </a>
              <a
                className="button button--secondary"
                href="https://github.com/moritzbrantner/reusable-workflows/tree/main/.github/workflows"
              >
                <ArrowUpRight aria-hidden="true" />
                Workflow files
              </a>
            </div>
          </div>

          <div className="signal-board" aria-label="Contract summary">
            <div className="signal-board__stats" role="list" aria-label="Contract metrics">
              <Stat className="signal-board__stat" role="listitem">
                <StatValue className="signal-board__stat-value">
                  {reusableWorkflows.length}
                </StatValue>
                <StatDescription className="signal-board__stat-description">
                  Reusable workflows
                </StatDescription>
              </Stat>
              <Stat className="signal-board__stat" role="listitem">
                <StatValue className="signal-board__stat-value">{totalInputs}</StatValue>
                <StatDescription className="signal-board__stat-description">
                  Documented inputs
                </StatDescription>
              </Stat>
              <Stat className="signal-board__stat" role="listitem">
                <StatValue className="signal-board__stat-value">{outputCount}</StatValue>
                <StatDescription className="signal-board__stat-description">
                  Workflow outputs
                </StatDescription>
              </Stat>
            </div>
            <div className="pipeline" aria-hidden="true">
              <span>caller</span>
              <span>validate</span>
              <span>deploy</span>
              <span>release</span>
            </div>
          </div>
        </section>

        <section className="section section--split" id="standard" aria-labelledby="standard-title">
          <div>
            <p className="eyebrow">Standard</p>
            <h2 id="standard-title">Small workflows, explicit contracts.</h2>
          </div>
          <div className="copy">
            <p>
              The repository keeps one machine-readable contract in{" "}
              <code>contracts/workflows.json</code> and validates it against the reusable workflow
              YAML. Consumers pin release tags such as <code>workflow-standard-v1</code> and opt
              into only the stages they need.
            </p>
            <p>
              The app is deployed through this repository's own <code>deploy-pages.yml</code>
              reusable workflow, so Pages publishing is part of the dogfood path.
            </p>
          </div>
        </section>

        <section
          className="section workflow-connections"
          id="connections"
          aria-labelledby="connections-title"
        >
          <div className="section__heading workflow-connections__heading">
            <div>
              <p className="eyebrow">Workflow Graph</p>
              <h2 id="connections-title">
                How local workflow callers connect to reusable contracts.
              </h2>
            </div>
            <p className="connection-copy">
              The graph maps local callers from <code>validate.yml</code>,{" "}
              <code>deploy-docs-pages.yml</code>, and <code>smoke-reusable-workflows.yml</code> to
              the reusable workflow files they invoke.
            </p>
          </div>

          <Card className="connection-panel">
            <CardHeader className="connection-panel__header">
              <div>
                <CardTitle>Local caller map</CardTitle>
                <CardDescription>
                  Edges show GitHub Actions jobs using reusable workflow contracts from this
                  repository.
                </CardDescription>
              </div>
              <div className="connection-badges" aria-label="Workflow graph legend">
                <Badge>Caller</Badge>
                <Badge variant="secondary">Reusable contract</Badge>
                <Badge variant="outline">Smoke coverage</Badge>
                <Badge variant="outline">No local caller</Badge>
              </div>
            </CardHeader>
            <CardContent className="connection-panel__content">
              <DependencyGraph
                ariaLabel="Local workflow caller connection graph"
                className="connection-graph"
                nodes={workflowGraphNodes}
                edges={workflowGraphEdges}
                showLegend
                caption="Edges show local caller workflows invoking reusable workflow contracts in this repository."
              />
            </CardContent>
          </Card>
        </section>

        <section className="section" id="workflows" aria-labelledby="workflows-title">
          <div className="section__heading workflow-index-heading">
            <div>
              <p className="eyebrow">Workflow Family</p>
              <h2 id="workflows-title">Every workflow has a reference page.</h2>
            </div>
            <p>
              Each page explains what the workflow owns, which workflows it invokes, which callers
              depend on it, and the contract surface exposed to repositories.
            </p>
          </div>

          <WorkflowIndex title="Reusable contracts" workflows={reusableWorkflows} />
          <WorkflowIndex title="Local callers" workflows={callerWorkflows} />
        </section>

        <section className="section section--split" id="dogfood" aria-labelledby="dogfood-title">
          <div>
            <p className="eyebrow">Dogfood</p>
            <h2 id="dogfood-title">The repo uses its own workflow contracts.</h2>
          </div>
          <div className="dogfood-grid">
            <article>
              <Card className="dogfood-card">
                <CardContent className="dogfood-card__content">
                  <ShieldCheck aria-hidden="true" />
                  <h3>Validate</h3>
                  <p>
                    CI calls <code>fast-validation.yml</code> with real format, lint, typecheck,
                    build, and contract validation commands for this app.
                  </p>
                </CardContent>
              </Card>
            </article>
            <article>
              <Card className="dogfood-card">
                <CardContent className="dogfood-card__content">
                  <Braces aria-hidden="true" />
                  <h3>Contract checks</h3>
                  <p>
                    A Bun TypeScript script checks workflow inputs, secrets, outputs, permissions,
                    and documentation tokens against the contract JSON.
                  </p>
                </CardContent>
              </Card>
            </article>
            <article>
              <Card className="dogfood-card">
                <CardContent className="dogfood-card__content">
                  <Globe2 aria-hidden="true" />
                  <h3>Pages deploy</h3>
                  <p>
                    Default-branch pushes build the React app and publish <code>dist/</code> through
                    the local <code>deploy-pages.yml</code> reusable workflow.
                  </p>
                </CardContent>
              </Card>
            </article>
          </div>
        </section>

        <MetricsSection history={buildMetricsHistory} />

        <section className="section section--split" aria-labelledby="adoption-title">
          <div>
            <p className="eyebrow">Adoption</p>
            <h2 id="adoption-title">Consumers pin a tag and pass explicit commands.</h2>
          </div>
          <CodeBlock
            className="code-panel"
            role="region"
            aria-label="Reusable workflow example"
            tabIndex={0}
          >
            <CodeBlockContent>
              <CodeBlockCode>{`jobs:
  fast-validation:
    permissions:
      contents: read
      packages: read
    uses: moritzbrantner/reusable-workflows/.github/workflows/fast-validation.yml@workflow-standard-v1
    with:
      lint_command: bun run lint
      typecheck_command: bun run check-types
      build_command: bun run build
      unit_test_command: bun run test:unit`}</CodeBlockCode>
            </CodeBlockContent>
          </CodeBlock>
        </section>

        <section className="section release" id="release" aria-labelledby="release-title">
          <div className="section__heading">
            <p className="eyebrow">Release Discipline</p>
            <h2 id="release-title">Tags are the consumer contract.</h2>
          </div>
          <ol className="release-steps">
            <li>
              Update workflow YAML and <code>contracts/workflows.json</code>.
            </li>
            <li>Update the repository docs and the canonical monorepo reference.</li>
            <li>Run contract validation, app verification, and actionlint.</li>
            <li>Confirm the smoke workflow and Pages deployment pass.</li>
            <li>Create a new release tag and roll it out through normal PRs.</li>
          </ol>
        </section>
      </main>
    </>
  );
}

function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a className="brand" href="/" aria-label="Reusable Workflows home">
          <span className="brand__mark" aria-hidden="true">
            RW
          </span>
          <span>Reusable Workflows</span>
        </a>
        <nav className="nav" aria-label="Primary navigation">
          <a href="/#standard">Standard</a>
          <a href="/#connections">Connections</a>
          <a href="/#workflows">Workflows</a>
          <a href="/#dogfood">Dogfood</a>
          <a href="/#metrics">Metrics</a>
          <a href="/#release">Release</a>
        </nav>
      </div>
    </header>
  );
}

function Badge({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "outline" | "secondary" }) {
  return (
    <span
      className={joinClassNames(
        "badge",
        variant !== "default" ? `badge--${variant}` : "",
        className,
      )}
      {...props}
    />
  );
}

function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={className} {...props} />;
}

function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={joinClassNames("card-header", className)} {...props} />;
}

function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={className} {...props} />;
}

function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={joinClassNames("card-title", className)} {...props} />;
}

function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={joinClassNames("card-description", className)} {...props} />;
}

function CodeBlock({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={className} {...props} />;
}

function CodeBlockContent({ className, ...props }: HTMLAttributes<HTMLPreElement>) {
  return <pre className={className} {...props} />;
}

function CodeBlockCode({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <code className={className} {...props} />;
}

function Stat({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={className} {...props} />;
}

function StatValue({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={className} {...props} />;
}

function StatDescription({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={className} {...props} />;
}

function joinClassNames(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

function DependencyGraph({
  ariaLabel,
  caption,
  className,
  edges = [],
  nodes,
  showLegend = false,
}: {
  ariaLabel: string;
  caption?: string;
  className?: string;
  edges?: readonly {
    id: string;
    kind?: string;
    label?: string;
    source: string;
    target: string;
  }[];
  nodes: readonly {
    description: string;
    group: string;
    height: number;
    id: string;
    label: string;
    status: string;
    tone: string;
    version?: string;
    width: number;
    x: number;
    y: number;
  }[];
  showLegend?: boolean;
}) {
  const padding = 56;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const width = Math.max(...nodes.map((node) => node.x + node.width)) + padding * 2;
  const height = Math.max(...nodes.map((node) => node.y + node.height)) + padding * 2;

  return (
    <figure className={className} data-slot="dependency-graph">
      <div data-slot="dependency-graph-scroll-area">
        <svg
          aria-label={ariaLabel}
          data-slot="dependency-graph-svg"
          role="img"
          viewBox={`0 0 ${width} ${height}`}
        >
          <defs>
            <marker
              id="workflow-graph-arrow"
              markerHeight="8"
              markerWidth="8"
              orient="auto"
              refX="7"
              refY="4"
              viewBox="0 0 8 8"
            >
              <path d="M0 0L8 4L0 8Z" />
            </marker>
          </defs>
          <g transform={`translate(${padding} ${padding})`}>
            {edges.map((edge, edgeIndex) => {
              const source = nodeById.get(edge.source);
              const target = nodeById.get(edge.target);

              if (!source || !target) {
                return null;
              }

              const sourceX = source.x + source.width;
              const sourceY = source.y + source.height / 2;
              const targetX = target.x;
              const targetY = target.y + target.height / 2;
              const curve = Math.max(64, Math.abs(targetX - sourceX) * 0.45);
              const labelX = sourceX + (targetX - sourceX) / 2;
              const labelY = sourceY + (targetY - sourceY) / 2 - 8 - (edgeIndex % 2) * 8;

              return (
                <g
                  className="workflow-graph__edge"
                  data-kind={edge.kind ?? "runtime"}
                  key={edge.id}
                >
                  <path
                    d={`M ${sourceX} ${sourceY} C ${sourceX + curve} ${sourceY}, ${targetX - curve} ${targetY}, ${targetX} ${targetY}`}
                  />
                  {edge.label ? (
                    <text x={labelX} y={labelY}>
                      {edge.label}
                    </text>
                  ) : null}
                </g>
              );
            })}
            {nodes.map((node) => (
              <g
                className="workflow-graph__node"
                data-status={node.status}
                data-tone={node.tone}
                key={node.id}
                transform={`translate(${node.x} ${node.y})`}
              >
                <rect height={node.height} rx="8" width={node.width} />
                <text className="workflow-graph__node-label" x="16" y="28">
                  {node.label}
                </text>
                <text className="workflow-graph__node-group" x="16" y="50">
                  {node.group}
                </text>
                <foreignObject height={node.height - 64} width={node.width - 32} x="16" y="60">
                  <p>{node.description}</p>
                </foreignObject>
              </g>
            ))}
          </g>
        </svg>
      </div>
      {showLegend ? (
        <div data-slot="dependency-graph-legend">
          <span data-tone="accent">Caller</span>
          <span data-tone="success">Reusable contract</span>
          <span data-tone="warning">Compatibility</span>
          <span data-tone="muted">No local caller</span>
        </div>
      ) : null}
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

function MetricsSection({ history }: { history: BuildMetricsHistory }) {
  const builds = history.builds;
  const latest = builds[0];

  return (
    <section className="section metrics-section" id="metrics" aria-labelledby="metrics-title">
      <div className="section__heading workflow-index-heading">
        <div>
          <p className="eyebrow">Build Metrics</p>
          <h2 id="metrics-title">Last 5 successful main performance runs.</h2>
        </div>
        <p>
          The published site carries a static metrics history from successful <code>Validate</code>{" "}
          performance jobs on <code>main</code>. Each deploy preserves the previous published JSON,
          prepends the latest run, and keeps the newest five builds.
        </p>
      </div>

      {latest ? (
        <>
          <div className="metrics-grid" aria-label="Latest build metrics">
            <MetricCard
              label="Build duration"
              value={formatDuration(latest.durations.buildMs)}
              detail={`Run #${latest.runNumber}`}
            />
            <MetricCard
              label="JS bundle"
              value={formatBytes(latest.bundle.jsBytes)}
              detail={latest.bundle.withinBudget === false ? "Above budget" : "Within budget"}
            />
            <MetricCard
              label="Benchmark"
              value={formatOps(latest.benchmark.operationsPerSecond)}
              detail={latest.benchmark.name ?? "No benchmark name"}
            />
            <MetricCard
              label="Lighthouse"
              value={formatScoreValue(latest.lighthouse.score)}
              detail={`LCP ${formatDuration(latest.lighthouse.metrics.largestContentfulPaintMs)}`}
            />
          </div>

          <MetricsTrendChart builds={builds} />

          <div className="metrics-history">
            <div className="metrics-history__header">
              <h3>Run history</h3>
              <span>
                Updated {history.generatedAt ? formatDateTime(history.generatedAt) : "after deploy"}
              </span>
            </div>
            <div className="metrics-table-wrap">
              <table className="metrics-table" aria-label="Last 5 build metrics">
                <thead>
                  <tr>
                    <th scope="col">Run</th>
                    <th scope="col">Commit</th>
                    <th scope="col">Completed</th>
                    <th scope="col">Build</th>
                    <th scope="col">Bundle</th>
                    <th scope="col">Ops/s</th>
                    <th scope="col">Lighthouse</th>
                    <th scope="col">LCP</th>
                    <th scope="col">CLS</th>
                  </tr>
                </thead>
                <tbody>
                  {builds.map((build) => (
                    <tr key={build.id}>
                      <td>
                        <a href={build.runUrl}>#{build.runNumber}</a>
                      </td>
                      <td>
                        <a href={build.commitUrl}>{build.commitShortSha}</a>
                      </td>
                      <td>{formatDateTime(build.completedAt)}</td>
                      <td>{formatDuration(build.durations.buildMs)}</td>
                      <td>{formatBytes(build.bundle.jsBytes)}</td>
                      <td>{formatOps(build.benchmark.operationsPerSecond)}</td>
                      <td>{formatScoreValue(build.lighthouse.score)}</td>
                      <td>{formatDuration(build.lighthouse.metrics.largestContentfulPaintMs)}</td>
                      <td>{formatDecimal(build.lighthouse.metrics.cumulativeLayoutShift)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <Card className="metrics-empty">
          <CardContent className="metrics-empty__content">
            <p>
              No published build metrics yet. The next successful main-branch performance run will
              populate this section.
            </p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function MetricsTrendChart({ builds }: { builds: BuildMetricsHistory["builds"] }) {
  const rows = createMetricsChartRows(builds);
  const legendItems: ChartLegendItem[] = metricsChartSeries.map((series) => ({
    color: series.color,
    id: series.id,
    label: series.label,
  }));
  const visibility = useChartSeriesVisibility({
    itemIds: metricsChartSeries.map((series) => series.id),
  });
  const visibleSeries = metricsChartSeries.filter((series) => visibility.isVisible(series.id));
  const chartWidth = 720;
  const chartHeight = 320;
  const chartPadding = { bottom: 36, left: 48, right: 20, top: 16 };
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const chartValues = rows.flatMap((row) =>
    visibleSeries.flatMap((series) => {
      const value = row[series.id];

      return typeof value === "number" && Number.isFinite(value) ? [value] : [];
    }),
  );
  const maxY = Math.max(125, Math.ceil((Math.max(...chartValues, 100) + 10) / 25) * 25);
  const yTicks = Array.from({ length: maxY / 25 + 1 }, (_, index) => index * 25);
  const getX = (index: number) =>
    chartPadding.left +
    (rows.length <= 1 ? plotWidth / 2 : (index / (rows.length - 1)) * plotWidth);
  const getY = (value: number) => chartPadding.top + plotHeight - (value / maxY) * plotHeight;
  const getPath = (seriesId: MetricsChartSeriesId) =>
    rows
      .flatMap((row, index) => {
        const value = row[seriesId];

        return typeof value === "number" && Number.isFinite(value)
          ? [`${index === 0 ? "M" : "L"} ${getX(index).toFixed(1)} ${getY(value).toFixed(1)}`]
          : [];
      })
      .join(" ");

  return (
    <ChartPanel
      className="metrics-chart-panel"
      title="Performance trend"
      description="Indexed to the latest run at 100 for cross-metric comparison."
    >
      <div className="metrics-chart-layout">
        <div className="metrics-chart" role="img" aria-label="Last 5 build metrics trend chart">
          <svg
            aria-hidden="true"
            className="metrics-chart__svg"
            preserveAspectRatio="none"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          >
            {yTicks.map((tick) => (
              <g key={tick}>
                <line
                  className="metrics-chart__grid-line"
                  x1={chartPadding.left}
                  x2={chartWidth - chartPadding.right}
                  y1={getY(tick)}
                  y2={getY(tick)}
                />
                <text
                  className="metrics-chart__axis-label"
                  x={chartPadding.left - 12}
                  y={getY(tick)}
                >
                  {tick}
                </text>
              </g>
            ))}
            {rows.map((row, index) => (
              <text
                className="metrics-chart__axis-label metrics-chart__axis-label--x"
                key={row.runLabel}
                x={getX(index)}
                y={chartHeight - 10}
              >
                {row.runLabel}
              </text>
            ))}
            {visibleSeries.map((series) => (
              <g key={series.id}>
                <path
                  className="metrics-chart__line"
                  d={getPath(series.id)}
                  stroke={series.color}
                />
                {rows.map((row, index) => {
                  const value = row[series.id];

                  if (typeof value !== "number" || !Number.isFinite(value)) {
                    return null;
                  }

                  return (
                    <circle
                      className="metrics-chart__point"
                      cx={getX(index)}
                      cy={getY(value)}
                      fill={series.color}
                      key={`${series.id}-${row.runLabel}`}
                      r={3.5}
                    >
                      <title>
                        {series.label}, {row.runLabel}: {row.raw[series.id]} ({Math.round(value)}{" "}
                        indexed)
                      </title>
                    </circle>
                  );
                })}
              </g>
            ))}
          </svg>
          <div className="metrics-chart__tooltip-list" aria-label="Chart values">
            {rows.map((row) => (
              <div key={row.runLabel}>
                <strong>{row.runLabel}</strong>
                <span>{row.completedLabel}</span>
                <dl>
                  {visibleSeries.map((series) => (
                    <div key={series.id}>
                      <dt>
                        <i style={{ backgroundColor: series.color }} aria-hidden="true" />
                        {series.label}
                      </dt>
                      <dd>{row.raw[series.id]}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </div>
        <ChartSeriesLegend
          hiddenIds={visibility.hiddenIds}
          items={legendItems}
          onHiddenIdsChange={visibility.setHiddenIds}
          orientation="vertical"
          showCounts={false}
        />
      </div>
    </ChartPanel>
  );
}

function ChartPanel({
  children,
  className,
  description,
  title,
}: {
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className={className}>
      <div>
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

function ChartSeriesLegend({
  "aria-label": ariaLabel = "Chart series legend",
  className,
  hiddenIds,
  items,
  onHiddenIdsChange,
  orientation = "vertical",
  showCounts = true,
}: {
  "aria-label"?: string;
  className?: string;
  hiddenIds: string[];
  items: ChartLegendItem[];
  onHiddenIdsChange: (hiddenIds: string[]) => void;
  orientation?: "horizontal" | "vertical";
  showCounts?: boolean;
}) {
  const itemIds = useMemo(() => items.map((item) => item.id), [items]);
  const visibility = useChartSeriesVisibility({
    hiddenIds,
    itemIds,
    onHiddenIdsChange,
  });

  return (
    <div
      aria-label={ariaLabel}
      className={["chart-series-legend", `chart-series-legend--${orientation}`, className]
        .filter(Boolean)
        .join(" ")}
      role="group"
    >
      {items.map((item) => {
        const visible = visibility.isVisible(item.id);

        return (
          <label className="chart-series-legend__item" key={item.id}>
            <input
              aria-label={typeof item.label === "string" ? item.label : undefined}
              checked={visible}
              disabled={item.disabled}
              onChange={() => visibility.toggle(item.id)}
              type="checkbox"
            />
            <span
              aria-hidden="true"
              className="chart-series-legend__swatch"
              style={{ backgroundColor: item.color ?? "var(--muted)" }}
            />
            <span className="chart-series-legend__content">
              <span className="chart-series-legend__label-row">
                <span className="chart-series-legend__label">{item.label}</span>
                {showCounts && item.meta ? (
                  <span className="chart-series-legend__meta">{item.meta}</span>
                ) : null}
              </span>
              {item.description ? (
                <span className="chart-series-legend__description">{item.description}</span>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function useChartSeriesVisibility({
  hiddenIds,
  itemIds,
  minVisible = 1,
  onHiddenIdsChange,
}: {
  hiddenIds?: string[];
  itemIds: string[];
  minVisible?: number;
  onHiddenIdsChange?: (hiddenIds: string[]) => void;
}) {
  const [uncontrolledHiddenIds, setUncontrolledHiddenIds] = useState<string[]>([]);
  const resolvedHiddenIds = useMemo(
    () => normalizeHiddenChartSeriesIds(hiddenIds ?? uncontrolledHiddenIds, itemIds, minVisible),
    [hiddenIds, itemIds, minVisible, uncontrolledHiddenIds],
  );
  const visibleIds = useMemo(
    () => itemIds.filter((id) => !resolvedHiddenIds.includes(id)),
    [itemIds, resolvedHiddenIds],
  );
  const setHiddenIds = useCallback(
    (nextHiddenIds: string[]) => {
      const normalized = normalizeHiddenChartSeriesIds(nextHiddenIds, itemIds, minVisible);

      if (hiddenIds === undefined) {
        setUncontrolledHiddenIds(normalized);
      }

      onHiddenIdsChange?.(normalized);
    },
    [hiddenIds, itemIds, minVisible, onHiddenIdsChange],
  );
  const toggle = useCallback(
    (id: string) => {
      if (!itemIds.includes(id)) {
        return;
      }

      if (resolvedHiddenIds.includes(id)) {
        setHiddenIds(resolvedHiddenIds.filter((hiddenId) => hiddenId !== id));
        return;
      }

      if (visibleIds.length <= minVisible) {
        return;
      }

      setHiddenIds([...resolvedHiddenIds, id]);
    },
    [itemIds, minVisible, resolvedHiddenIds, setHiddenIds, visibleIds.length],
  );
  const isVisible = useCallback((id: string) => visibleIds.includes(id), [visibleIds]);

  return {
    hiddenIds: resolvedHiddenIds,
    isVisible,
    setHiddenIds,
    toggle,
    visibleIds,
  };
}

function normalizeHiddenChartSeriesIds(hiddenIds: string[], itemIds: string[], minVisible: number) {
  const hiddenIdSet = new Set(hiddenIds);
  const maxHiddenCount = Math.max(0, itemIds.length - Math.max(0, minVisible));

  return itemIds.filter((id) => hiddenIdSet.has(id)).slice(0, maxHiddenCount);
}

function MetricCard({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <Card className="metrics-card">
      <CardContent className="metrics-card__content">
        <span>{label}</span>
        <strong>{value}</strong>
        <p>{detail}</p>
      </CardContent>
    </Card>
  );
}

function WorkflowIndex({ title, workflows }: { title: string; workflows: ParsedWorkflow[] }) {
  return (
    <div className="workflow-index-group">
      <h3>{title}</h3>
      <div className="workflow-list">
        {workflows.map((workflow) => (
          <article key={workflow.file}>
            <a className="workflow-card-link" href={workflowHref(workflow.slug)}>
              <Card className="workflow-card">
                <CardContent className="workflow-card__content">
                  <div className="workflow-card__title-row">
                    <workflow.icon aria-hidden="true" />
                    <h4>{workflow.title}</h4>
                  </div>
                  <p>{workflow.summary}</p>
                  <dl>
                    <div>
                      <dt>Inputs</dt>
                      <dd>{Object.keys(workflow.contract?.inputs ?? {}).length}</dd>
                    </div>
                    {workflow.dependencies.length > 0 ? (
                      <div>
                        <dt>Uses</dt>
                        <dd>{workflow.dependencies.length}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Callers</dt>
                      <dd>{workflow.callers.length}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </a>
          </article>
        ))}
      </div>
    </div>
  );
}

function WorkflowPage({ workflow }: { workflow: ParsedWorkflow }) {
  const contract = workflow.contract;
  const dependencyWorkflows = workflow.dependencies
    .map((file) => parsedWorkflowsByFile.get(file))
    .filter((dependency): dependency is ParsedWorkflow => Boolean(dependency));
  const callerWorkflows = workflow.callers
    .map((file) => parsedWorkflowsByFile.get(file))
    .filter((caller): caller is ParsedWorkflow => Boolean(caller));
  const showDependencyCard = workflow.role === "Local caller" || dependencyWorkflows.length > 0;

  return (
    <>
      <SiteHeader />
      <main id="top">
        <section className="workflow-hero" aria-labelledby="workflow-title">
          <div className="workflow-hero__body">
            <a className="back-link" href="/#workflows">
              <ArrowLeft aria-hidden="true" />
              All workflows
            </a>
            <p className="eyebrow">{workflow.role}</p>
            <h1 id="workflow-title">{workflow.title}</h1>
            <p className="hero__lede">{workflow.summary}</p>
            <div className="workflow-hero__meta" aria-label="Workflow metadata">
              <Badge>{workflow.file}</Badge>
              <Badge variant="secondary">{workflow.yamlName}</Badge>
              <Badge variant="outline">{workflowContracts.workflow_standard}</Badge>
            </div>
          </div>
          <div className="workflow-hero__stats" aria-label={`${workflow.title} metrics`}>
            <Stat className="signal-board__stat">
              <StatValue className="signal-board__stat-value">{workflow.jobs.length}</StatValue>
              <StatDescription className="signal-board__stat-description">Jobs</StatDescription>
            </Stat>
            <Stat className="signal-board__stat">
              <StatValue className="signal-board__stat-value">
                {workflow.dependencies.length}
              </StatValue>
              <StatDescription className="signal-board__stat-description">
                Uses workflows
              </StatDescription>
            </Stat>
            <Stat className="signal-board__stat">
              <StatValue className="signal-board__stat-value">{workflow.callers.length}</StatValue>
              <StatDescription className="signal-board__stat-description">Callers</StatDescription>
            </Stat>
            <Stat className="signal-board__stat">
              <StatValue className="signal-board__stat-value">
                {Object.keys(contract?.inputs ?? {}).length}
              </StatValue>
              <StatDescription className="signal-board__stat-description">Inputs</StatDescription>
            </Stat>
          </div>
        </section>

        <section className="section workflow-page-grid" aria-labelledby="overview-title">
          <div>
            <p className="eyebrow">Overview</p>
            <h2 id="overview-title">What this workflow owns</h2>
          </div>
          <div className="workflow-detail-stack">
            <Card className="detail-card">
              <CardHeader>
                <CardTitle>When to use it</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{workflow.useWhen}</p>
              </CardContent>
            </Card>
            <Card className="detail-card">
              <CardHeader>
                <CardTitle>Responsibilities</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="plain-list">
                  {workflow.responsibilities.map((responsibility) => (
                    <li key={responsibility}>{responsibility}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card className="detail-card">
              <CardHeader>
                <CardTitle>Triggers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="chip-list">
                  {workflow.triggers.map((trigger) => (
                    <Badge key={trigger} variant="outline">
                      {trigger}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="section workflow-page-grid" aria-labelledby="dependency-title">
          <div>
            <p className="eyebrow">Dependencies</p>
            <h2 id="dependency-title">What it uses and who uses it</h2>
          </div>
          <div
            className={`dependency-columns${showDependencyCard ? "" : " dependency-columns--single"}`}
          >
            {showDependencyCard ? (
              <RelationshipCard
                title="Uses these workflows"
                emptyText="This workflow does not call another local reusable workflow."
                workflows={dependencyWorkflows}
              />
            ) : null}
            <RelationshipCard
              title="Used by these workflows"
              emptyText="No local workflow currently calls this workflow."
              workflows={callerWorkflows}
            />
          </div>
        </section>

        <section className="section workflow-page-grid" aria-labelledby="jobs-title">
          <div>
            <p className="eyebrow">Execution</p>
            <h2 id="jobs-title">Jobs in this workflow</h2>
          </div>
          <div className="job-list">
            {workflow.jobs.map((job) => (
              <Card className="job-card" key={job.id}>
                <CardHeader>
                  <div className="card-title">{job.name}</div>
                  <CardDescription>{job.id}</CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="key-values">
                    {job.uses ? (
                      <div>
                        <dt>Uses</dt>
                        <dd>{job.usesWorkflow ?? job.uses}</dd>
                      </div>
                    ) : null}
                    {job.runsOn ? (
                      <div>
                        <dt>Runs on</dt>
                        <dd>{job.runsOn}</dd>
                      </div>
                    ) : null}
                    {job.needs.length > 0 ? (
                      <div>
                        <dt>Needs</dt>
                        <dd>{job.needs.join(", ")}</dd>
                      </div>
                    ) : null}
                    {job.timeoutMinutes ? (
                      <div>
                        <dt>Timeout</dt>
                        <dd>{job.timeoutMinutes} minutes</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Steps</dt>
                      <dd>{job.stepCount}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="section workflow-page-grid" aria-labelledby="contract-title">
          <div>
            <p className="eyebrow">Contract</p>
            <h2 id="contract-title">Contract surface, secrets, and permissions</h2>
          </div>
          {contract ? (
            <div className="workflow-detail-stack">
              <ContractFields title="Inputs" fields={contract.inputs} />
              <ContractFields title="Secrets" fields={contract.secrets ?? {}} />
              <ContractFields title="Outputs" fields={contract.outputs ?? {}} />
              <PermissionFields permissions={contract.permissions} />
            </div>
          ) : (
            <Card className="detail-card">
              <CardContent>
                <p>
                  This is a local caller workflow. It is documented from the YAML source, but it is
                  not part of <code>contracts/workflows.json</code>.
                </p>
              </CardContent>
            </Card>
          )}
        </section>

        <section className="section section--split" aria-labelledby="usage-title">
          <div>
            <p className="eyebrow">Usage</p>
            <h2 id="usage-title">Reference snippet</h2>
          </div>
          <CodeBlock
            className="code-panel"
            role="region"
            aria-label={`${workflow.title} usage example`}
            tabIndex={0}
          >
            <CodeBlockContent>
              <CodeBlockCode>{buildUsageSnippet(workflow)}</CodeBlockCode>
            </CodeBlockContent>
          </CodeBlock>
        </section>
      </main>
    </>
  );
}

function RelationshipCard({
  title,
  emptyText,
  workflows,
}: {
  title: string;
  emptyText: string;
  workflows: ParsedWorkflow[];
}) {
  return (
    <Card className="detail-card relationship-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {workflows.length > 0 ? (
          <ul className="relationship-list">
            {workflows.map((workflow) => (
              <li key={workflow.file}>
                <a href={workflowHref(workflow.slug)}>
                  <span>{workflow.title}</span>
                  <code>{workflow.file}</code>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p>{emptyText}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ContractFields({
  title,
  fields,
}: {
  title: string;
  fields: Record<
    string,
    ContractField | { required?: boolean; description?: string; value?: string }
  >;
}) {
  const entries = Object.entries(fields);

  return (
    <Card className="detail-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {entries.length} documented {title.toLowerCase()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length > 0 ? (
          <div className="contract-table" role="table" aria-label={`${title} contract fields`}>
            {entries.map(([name, field]) => (
              <div className="contract-row" role="row" key={name}>
                <div role="cell">
                  <code>{name}</code>
                  {"type" in field && field.type ? <span>{field.type}</span> : null}
                </div>
                <div role="cell">
                  {"required" in field && field.required ? "Required" : "Optional"}
                  {"default" in field && field.default !== undefined
                    ? `, default ${formatValue(field.default)}`
                    : ""}
                  {"description" in field && field.description ? `, ${field.description}` : ""}
                  {"value" in field && field.value ? `, ${field.value}` : ""}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>No {title.toLowerCase()} are documented for this workflow.</p>
        )}
      </CardContent>
    </Card>
  );
}

function PermissionFields({ permissions }: { permissions: Record<string, string> }) {
  return (
    <Card className="detail-card">
      <CardHeader>
        <CardTitle>Permissions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="chip-list">
          {Object.entries(permissions).map(([permission, access]) => (
            <Badge key={permission} variant="outline">
              {permission}: {access}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

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

function buildUsageSnippet(workflow: ParsedWorkflow) {
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

function formatValue(value: unknown) {
  if (typeof value === "string") {
    return value === "" ? "empty string" : value;
  }

  return JSON.stringify(value);
}

function formatDuration(value: number | null) {
  if (value === null) {
    return "n/a";
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}s`;
  }

  return `${Math.round(value)}ms`;
}

function formatBytes(value: number | null) {
  if (value === null) {
    return "n/a";
  }

  return `${Math.round(value / 1024).toLocaleString("en-US")} KB`;
}

function formatOps(value: number | null) {
  return value === null ? "n/a" : value.toLocaleString("en-US");
}

function formatScoreValue(value: number | null) {
  return value === null ? "n/a" : `${Math.round(value * 100)}%`;
}

function formatDecimal(value: number | null) {
  return value === null ? "n/a" : value.toFixed(3).replace(/\.?0+$/, "");
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function createMetricsChartRows(builds: BuildMetricsHistory["builds"]): MetricsChartDatum[] {
  const chronologicalBuilds = [...builds].reverse();
  const latest = builds[0];

  return chronologicalBuilds.map((build) => ({
    benchmark: normalizeMetric(
      build.benchmark.operationsPerSecond,
      latest.benchmark.operationsPerSecond,
    ),
    build: normalizeMetric(build.durations.buildMs, latest.durations.buildMs),
    bundle: normalizeMetric(build.bundle.jsBytes, latest.bundle.jsBytes),
    completedLabel: formatDateTime(build.completedAt),
    lighthouse: normalizeMetric(build.lighthouse.score, latest.lighthouse.score),
    raw: {
      benchmark: formatOps(build.benchmark.operationsPerSecond),
      build: formatDuration(build.durations.buildMs),
      bundle: formatBytes(build.bundle.jsBytes),
      lighthouse: formatScoreValue(build.lighthouse.score),
    },
    runLabel: `#${build.runNumber}`,
  }));
}

function normalizeMetric(value: number | null, referenceValue: number | null) {
  if (value === null) {
    return undefined;
  }

  if (referenceValue === null || referenceValue === 0) {
    return undefined;
  }

  return Math.round((value / referenceValue) * 1000) / 10;
}

function slugFromFile(file: string) {
  return (
    file
      .split("/")
      .at(-1)
      ?.replace(/\.ya?ml$/, "") ?? file
  );
}

function slugFromPath(pathname: string) {
  let candidate = "";

  for (const part of pathname.split("/")) {
    if (part) {
      candidate = part;
    }
  }

  return candidate && parsedWorkflowsBySlug.has(candidate) ? candidate : "";
}

function workflowHref(slug: string) {
  return `/${slug}`;
}

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export { App, parsedWorkflows };
