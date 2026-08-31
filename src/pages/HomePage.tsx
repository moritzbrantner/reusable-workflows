import { ArrowUpRight, Boxes, Braces, Globe2, ShieldCheck } from "lucide-react";

import workflowContracts from "../../contracts/workflows.json";
import { buildMetricsHistory } from "../app/metricsCatalog";
import { adoptionHref } from "../app/routes";
import {
  parsedWorkflows,
  workflowGraphEdges,
  workflowGraphNodes,
  workflowInputMetrics,
} from "../app/workflowCatalog";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CodeBlock,
  CodeBlockCode,
  CodeBlockContent,
  StatDescription,
  StatValue,
} from "../components/ui";
import { DependencyGraph } from "../components/DependencyGraph";
import { MetricsSection } from "../components/MetricsSection";
import { SiteHeader } from "../components/SiteHeader";
import { WorkflowIndex } from "../components/WorkflowIndex";

export function HomePage() {
  const reusableWorkflows = parsedWorkflows.filter(
    (workflow) => workflow.role === "Reusable Workflow",
  );
  const callerWorkflows = parsedWorkflows.filter((workflow) => workflow.role === "Caller Workflow");
  const { totalInputSlots, uniqueInputNames } = workflowInputMetrics(parsedWorkflows);
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
            <h1 id="hero-title">Optional hosted workflow capabilities for maintained repos.</h1>
            <p className="hero__lede">
              A React-built reference for reusable adapters that support repository-owned
              validation, delivery, release, and compatibility flows without defining a lifecycle
              standard.
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
              <a className="button button--secondary" href={adoptionHref()}>
                <ShieldCheck aria-hidden="true" />
                Adoption tool
              </a>
            </div>
          </div>

          <div className="signal-board" aria-label="Contract summary">
            <ul className="signal-board__stats" aria-label="Contract metrics">
              <li className="signal-board__stat">
                <StatValue className="signal-board__stat-value">
                  {reusableWorkflows.length}
                </StatValue>
                <StatDescription className="signal-board__stat-description">
                  Reusable workflows
                </StatDescription>
              </li>
              <li className="signal-board__stat">
                <StatValue className="signal-board__stat-value">{uniqueInputNames}</StatValue>
                <StatDescription className="signal-board__stat-description">
                  Unique inputs
                  <span>{totalInputSlots} workflow-specific input slots</span>
                </StatDescription>
              </li>
              <li className="signal-board__stat">
                <StatValue className="signal-board__stat-value">{outputCount}</StatValue>
                <StatDescription className="signal-board__stat-description">
                  Workflow outputs
                </StatDescription>
              </li>
            </ul>
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
              <code>contracts/workflows.json</code> is the frozen compatibility snapshot for{" "}
              <code>workflow-standard-v1.3</code>. Current workflow interfaces come from their YAML;
              consumers select only the hosted capabilities they need and own their lifecycle
              timing.
            </p>
            <p>
              The app is deployed through this repository's own <code>deploy-pages.yml</code>
              Reusable Workflow, so Pages publishing is part of the dogfood path.
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
              <h2 id="connections-title">How Caller Workflows connect to Reusable Workflows.</h2>
            </div>
            <p className="connection-copy">
              The graph maps Caller Workflows from <code>validate.yml</code>,{" "}
              <code>deploy-docs-pages.yml</code>, and <code>smoke-reusable-workflows.yml</code> to
              the Reusable Workflows they invoke.
            </p>
          </div>

          <Card className="connection-panel">
            <CardHeader className="connection-panel__header">
              <div>
                <CardTitle>Caller Workflow map</CardTitle>
                <CardDescription>
                  Edges show GitHub Actions jobs using Reusable Workflows from this repository.
                </CardDescription>
              </div>
              <div className="connection-badges" aria-label="Workflow graph legend">
                <Badge>Caller Workflow</Badge>
                <Badge variant="secondary">Reusable Workflow</Badge>
                <Badge variant="outline">Smoke coverage</Badge>
                <Badge variant="outline">No caller workflow</Badge>
              </div>
            </CardHeader>
            <CardContent className="connection-panel__content">
              <DependencyGraph
                ariaLabel="Caller Workflow connection graph"
                className="connection-graph"
                nodes={workflowGraphNodes}
                edges={workflowGraphEdges}
                showLegend
                caption="Edges show Caller Workflows invoking Reusable Workflows in this repository."
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
              Each page explains what the workflow owns, which workflows it invokes, which Caller
              Workflows depend on it, and the Workflow Contract surface exposed to repositories.
            </p>
          </div>

          <WorkflowIndex title="Reusable Workflows" workflows={reusableWorkflows} />
          <WorkflowIndex
            showContractMetrics={false}
            title="Caller Workflows"
            workflows={callerWorkflows}
          />
        </section>

        <section className="section section--split" id="dogfood" aria-labelledby="dogfood-title">
          <div>
            <p className="eyebrow">Dogfood</p>
            <h2 id="dogfood-title">The repo uses its own Workflow Contracts.</h2>
          </div>
          <div className="dogfood-grid">
            <article>
              <Card className="dogfood-card">
                <CardContent className="dogfood-card__content">
                  <ShieldCheck aria-hidden="true" />
                  <h3>Validate</h3>
                  <p>
                    CI calls <code>fast-validation.yml</code> with real format, lint, typecheck,
                    build, and Workflow Contract validation commands for this app.
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
                    and documentation tokens against the Contract Manifest.
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
                    the <code>deploy-pages.yml</code> Reusable Workflow.
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
    uses: moritzbrantner/reusable-workflows/.github/workflows/fast-validation.yml@workflow-standard-v1.3
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
            <h2 id="release-title">Release Tags are the consumer contract.</h2>
          </div>
          <ol className="release-steps">
            <li>
              Update workflow YAML and <code>contracts/workflows.json</code>.
            </li>
            <li>
              Update the repository docs and scaffold reference when scaffold expectations change.
            </li>
            <li>Run contract validation, app verification, and actionlint.</li>
            <li>Confirm the smoke workflow and Pages deployment pass.</li>
            <li>Create a new release tag and roll it out through normal PRs.</li>
          </ol>
        </section>
      </main>
    </>
  );
}
