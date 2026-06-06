import {
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
  PackageCheck,
  Rocket,
  ShieldCheck,
  TestTube2,
} from "lucide-react";
import { Button } from "@moritzbrantner/ui/components/stable/button";
import { Card, CardContent } from "@moritzbrantner/ui/components/stable/card";
import {
  CodeBlock,
  CodeBlockCode,
  CodeBlockContent,
} from "@moritzbrantner/ui/components/stable/code-block";
import { Stat, StatDescription, StatValue } from "@moritzbrantner/ui/components/stable/stat";

import workflowContracts from "../contracts/workflows.json";

type WorkflowContract = {
  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  permissions: Record<string, string>;
};

const workflowDetails = [
  {
    file: ".github/workflows/fast-validation.yml",
    title: "Fast Validation",
    summary: "Formatting, linting, typechecking, builds, and unit tests for tight PR feedback.",
    icon: CheckCircle2,
  },
  {
    file: ".github/workflows/integration-validation.yml",
    title: "Integration Validation",
    summary: "Service checks, database checks, migrations, package checks, and integration suites.",
    icon: Layers3,
  },
  {
    file: ".github/workflows/e2e-validation.yml",
    title: "E2E Validation",
    summary: "Browser, Playwright, Electron, Tauri, mobile, and artifact-backed e2e runs.",
    icon: TestTube2,
  },
  {
    file: ".github/workflows/storybook-validation.yml",
    title: "Storybook Validation",
    summary: "Storybook builds, interaction tests, accessibility checks, and visual validation.",
    icon: BookOpen,
  },
  {
    file: ".github/workflows/performance-validation.yml",
    title: "Performance Validation",
    summary: "Unlighthouse, benchmarks, bundle size checks, API reports, and heavier suites.",
    icon: Gauge,
  },
  {
    file: ".github/workflows/deploy-pages.yml",
    title: "Deploy Pages",
    summary: "GitHub Pages configuration, artifact upload, deployment, and page_url output.",
    icon: Globe2,
  },
  {
    file: ".github/workflows/release-template.yml",
    title: "Release Template",
    summary: "Validate, build, publish, and upload release artifacts with explicit secrets.",
    icon: Rocket,
  },
  {
    file: ".github/workflows/stage-validation.yml",
    title: "Stage Validation",
    summary: "Stage-specific branch checks for develop, nightly, beta, staging, and production.",
    icon: GitBranch,
  },
  {
    file: ".github/workflows/promote-branches.yml",
    title: "Promote Branches",
    summary: "Exact tested SHA promotion between branches with force-with-lease safeguards.",
    icon: GitPullRequestArrow,
  },
  {
    file: ".github/workflows/validate-repo.yml",
    title: "Validate Repo",
    summary: "Compatibility workflow for existing scaffold-v2 repositories during migration.",
    icon: PackageCheck,
  },
] as const;

const contracts = workflowContracts.workflows as Record<string, WorkflowContract>;

function App() {
  const workflowCount = Object.keys(contracts).length;
  const totalInputs = Object.values(contracts).reduce(
    (count, contract) => count + Object.keys(contract.inputs).length,
    0,
  );
  const outputCount = Object.values(contracts).filter(
    (contract) => Object.keys(contract.outputs ?? {}).length > 0,
  ).length;

  return (
    <>
      <header className="site-header">
        <div className="site-header__inner">
          <a className="brand" href="#top" aria-label="Reusable Workflows home">
            <span className="brand__mark" aria-hidden="true">
              RW
            </span>
            <span>Reusable Workflows</span>
          </a>
          <nav className="nav" aria-label="Primary navigation">
            <a href="#standard">Standard</a>
            <a href="#workflows">Workflows</a>
            <a href="#dogfood">Dogfood</a>
            <a href="#release">Release</a>
          </nav>
        </div>
      </header>

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
                <StatValue className="signal-board__stat-value">{workflowCount}</StatValue>
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

        <section className="section" id="workflows" aria-labelledby="workflows-title">
          <div className="section__heading">
            <p className="eyebrow">Workflow Family</p>
            <h2 id="workflows-title">What each reusable workflow owns</h2>
          </div>

          <div className="workflow-list">
            {workflowDetails.map(({ file, title, summary, icon: Icon }) => {
              const contract = contracts[file];
              return (
                <article key={file}>
                  <Card className="workflow-card">
                    <CardContent className="workflow-card__content">
                      <Icon aria-hidden="true" />
                      <h3>{title}</h3>
                      <p>{summary}</p>
                      <dl>
                        <div>
                          <dt>Inputs</dt>
                          <dd>{Object.keys(contract.inputs).length}</dd>
                        </div>
                        <div>
                          <dt>Permissions</dt>
                          <dd>{Object.keys(contract.permissions).length}</dd>
                        </div>
                      </dl>
                    </CardContent>
                  </Card>
                </article>
              );
            })}
          </div>
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
      unit_test_command: bun run test:unit
    secrets:
      GH_PACKAGES_TOKEN: \${{ secrets.GH_PACKAGES_TOKEN }}`}</CodeBlockCode>
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

export { App };
