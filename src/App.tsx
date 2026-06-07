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
import { DependencyGraph } from "@moritzbrantner/diagrams";
import { Badge } from "@moritzbrantner/ui/components/stable/badge";
import { Button } from "@moritzbrantner/ui/components/stable/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@moritzbrantner/ui/components/stable/card";
import {
  CodeBlock,
  CodeBlockCode,
  CodeBlockContent,
} from "@moritzbrantner/ui/components/stable/code-block";
import { Stat, StatDescription, StatValue } from "@moritzbrantner/ui/components/stable/stat";
import { parse } from "yaml";

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
              <Button asChild className="button button--primary">
                <a href="https://github.com/moritzbrantner/reusable-workflows">
                  <Boxes aria-hidden="true" />
                  Repository
                </a>
              </Button>
              <Button asChild className="button button--secondary">
                <a href="https://github.com/moritzbrantner/reusable-workflows/tree/main/.github/workflows">
                  <ArrowUpRight aria-hidden="true" />
                  Workflow files
                </a>
              </Button>
            </div>
          </div>

          <div className="signal-board" aria-label="Contract summary">
            <div className="signal-board__stats" role="list" aria-label="Contract metrics">
              <Stat className="signal-board__stat">
                <StatValue className="signal-board__stat-value">
                  {reusableWorkflows.length}
                </StatValue>
                <StatDescription className="signal-board__stat-description">
                  Reusable workflows
                </StatDescription>
              </Stat>
              <Stat className="signal-board__stat">
                <StatValue className="signal-board__stat-value">{totalInputs}</StatValue>
                <StatDescription className="signal-board__stat-description">
                  Documented inputs
                </StatDescription>
              </Stat>
              <Stat className="signal-board__stat">
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
                      <td>
                        <MetricTrend
                          value={build.durations.buildMs}
                          label={formatDuration(build.durations.buildMs)}
                          values={builds.map((item) => item.durations.buildMs)}
                        />
                      </td>
                      <td>
                        <MetricTrend
                          value={build.bundle.jsBytes}
                          label={formatBytes(build.bundle.jsBytes)}
                          values={builds.map((item) => item.bundle.jsBytes)}
                        />
                      </td>
                      <td>
                        <MetricTrend
                          value={build.benchmark.operationsPerSecond}
                          label={formatOps(build.benchmark.operationsPerSecond)}
                          values={builds.map((item) => item.benchmark.operationsPerSecond)}
                        />
                      </td>
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

function MetricTrend({
  label,
  value,
  values,
}: {
  label: string;
  value: number | null;
  values: Array<number | null>;
}) {
  const width = trendWidth(value, values);

  return (
    <div className="metrics-trend">
      <span>{label}</span>
      <div aria-hidden="true">
        <i style={{ width: `${width}%` }} />
      </div>
    </div>
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
                  <CardTitle>{job.name}</CardTitle>
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
            <h2 id="contract-title">Inputs, outputs, secrets, and permissions</h2>
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
  const parsed = parse(source) as Record<string, unknown>;
  const jobsRecord = isRecord(parsed.jobs) ? parsed.jobs : {};

  return {
    ...metadata,
    slug: slugFromFile(file),
    source,
    yamlName: typeof parsed.name === "string" ? parsed.name : metadata.title,
    triggers: parseTriggers(parsed.on),
    jobs: parseJobs(jobsRecord),
    dependencies: Array.from(
      new Set(parseJobs(jobsRecord).flatMap((job) => job.usesWorkflow ?? [])),
    ),
    contract: contracts[file],
  };
}

function parseJobs(jobsRecord: Record<string, unknown>) {
  return Object.entries(jobsRecord).map(([id, job]) => {
    const jobRecord = isRecord(job) ? job : {};
    const uses = typeof jobRecord.uses === "string" ? jobRecord.uses : undefined;
    const steps = Array.isArray(jobRecord.steps) ? jobRecord.steps : [];

    return {
      id,
      name: typeof jobRecord.name === "string" ? jobRecord.name : titleFromSlug(id),
      uses,
      usesWorkflow: uses ? normalizeWorkflowRef(uses) : undefined,
      needs: parseStringList(jobRecord.needs),
      runsOn: parseRunsOn(jobRecord["runs-on"]),
      timeoutMinutes:
        typeof jobRecord["timeout-minutes"] === "number" ? jobRecord["timeout-minutes"] : undefined,
      stepCount: steps.length,
    };
  });
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

function parseTriggers(onValue: unknown) {
  if (typeof onValue === "string") {
    return [onValue];
  }

  if (Array.isArray(onValue)) {
    return onValue.map(String);
  }

  if (isRecord(onValue)) {
    return Object.keys(onValue);
  }

  return ["workflow_call"];
}

function parseStringList(value: unknown) {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.map(String);
  }

  return [];
}

function parseRunsOn(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(String).join(", ");
  }

  return undefined;
}

function normalizeWorkflowRef(ref: string) {
  const refWithoutVersion = ref.split("@")[0];
  const workflowIndex = refWithoutVersion.indexOf(".github/workflows/");

  return workflowIndex >= 0 ? refWithoutVersion.slice(workflowIndex) : undefined;
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

function trendWidth(value: number | null, values: Array<number | null>) {
  if (value === null) {
    return 0;
  }

  const numericValues = values.filter((candidate): candidate is number => candidate !== null);
  const max = Math.max(...numericValues);

  if (!Number.isFinite(max) || max <= 0) {
    return 0;
  }

  return Math.max(8, Math.round((value / max) * 100));
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export { App, parsedWorkflows };
