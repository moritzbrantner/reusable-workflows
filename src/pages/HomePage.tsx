import { ArrowUpRight, Boxes, Braces, Globe2, ShieldCheck } from "lucide-react";

import workflowContracts from "../../contracts/workflows.json";
import { buildMetricsHistory } from "../app/metricsCatalog";
import { adoptionHref } from "../app/routes";
import { parsedWorkflows, workflowGraphEdges, workflowGraphNodes } from "../app/workflowCatalog";
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
  const reusableWorkflows = parsedWorkflows.filter((workflow) =>
    workflow.triggers.includes("workflow_call"),
  );
  const callerWorkflows = parsedWorkflows.filter(
    (workflow) => !workflow.triggers.includes("workflow_call"),
  );
  const compatibilityWorkflowCount = Object.keys(workflowContracts.workflows).length;

  return (
    <>
      <SiteHeader />

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__content">
            <p className="eyebrow">Independent capability line</p>
            <h1 id="hero-title">
              Thin GitHub adapters for repository-owned validation and delivery.
            </h1>
            <p className="hero__lede">
              Repository commands and coding-tooling own deterministic semantics. These workflows
              reproduce selected checks, evidence transport, deployment, publication, and
              maintenance operations on GitHub without defining how a repository develops.
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
                v1.3 compatibility tool
              </a>
            </div>
          </div>

          <div className="signal-board" aria-label="Capability summary">
            <ul className="signal-board__stats" aria-label="Capability metrics">
              <li className="signal-board__stat">
                <StatValue className="signal-board__stat-value">
                  {reusableWorkflows.length}
                </StatValue>
                <StatDescription className="signal-board__stat-description">
                  Hosted capabilities
                </StatDescription>
              </li>
              <li className="signal-board__stat">
                <StatValue className="signal-board__stat-value">{callerWorkflows.length}</StatValue>
                <StatDescription className="signal-board__stat-description">
                  Repository callers
                  <span>Lifecycle policy stays with the caller</span>
                </StatDescription>
              </li>
              <li className="signal-board__stat">
                <StatValue className="signal-board__stat-value">
                  {compatibilityWorkflowCount}
                </StatValue>
                <StatDescription className="signal-board__stat-description">
                  Frozen v1.3 workflows
                  <span>Compatibility only</span>
                </StatDescription>
              </li>
            </ul>
            <div className="pipeline" aria-hidden="true">
              <span>repository</span>
              <span>coding-tooling</span>
              <span>GitHub adapter</span>
              <span>evidence / delivery</span>
            </div>
          </div>
        </section>

        <section className="section section--split" id="standard" aria-labelledby="standard-title">
          <div>
            <p className="eyebrow">Ownership boundary</p>
            <h2 id="standard-title">Local semantics first. GitHub transport second.</h2>
          </div>
          <div className="copy">
            <p>
              <code>coding-agent-conventions</code> describes preferred repository behavior.
              Repository-owned commands and <code>coding-tooling</code> implement deterministic
              capabilities and tiers. This repository provides optional GitHub-hosted execution and
              delivery adapters around those interfaces.
            </p>
            <p>
              Workflow YAML on <code>main</code> is the source of truth for current capability
              interfaces. <code>contracts/workflows.json</code> remains frozen as the historical
              <code>{workflowContracts.workflow_standard}</code> compatibility snapshot and must not
              be evolved alongside current capabilities.
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
              <p className="eyebrow">Repository Dogfood Graph</p>
              <h2 id="connections-title">How this repository exercises its hosted workflows.</h2>
            </div>
            <p className="connection-copy">
              This graph is intentionally narrower than the full capability catalog. It maps the
              public repository's own Caller Workflows from <code>validate.yml</code>,{" "}
              <code>deploy-docs-pages.yml</code>, and <code>smoke-reusable-workflows.yml</code>. The
              private <code>coding-tooling-validation.yml</code> adapter is exercised by consumers
              that can access coding-tooling.
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
                caption="Edges show this repository's Caller Workflows invoking Reusable Workflows."
              />
            </CardContent>
          </Card>
        </section>

        <section className="section" id="workflows" aria-labelledby="workflows-title">
          <div className="section__heading workflow-index-heading">
            <div>
              <p className="eyebrow">Capability Catalog</p>
              <h2 id="workflows-title">Current YAML is the capability source of truth.</h2>
            </div>
            <p>
              Reusable capabilities are detected from <code>workflow_call</code>. Caller Workflows
              own lifecycle triggers and composition. Specialized and compatibility workflows remain
              available, but new validation architecture should prefer coding-tooling or one
              repository-owned command rather than growing semantic YAML interfaces.
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
            <h2 id="dogfood-title">The repo exercises the same boundaries it recommends.</h2>
          </div>
          <div className="dogfood-grid">
            <article>
              <Card className="dogfood-card">
                <CardContent className="dogfood-card__content">
                  <ShieldCheck aria-hidden="true" />
                  <h3>Progressive validation</h3>
                  <p>
                    Pull requests start with the generic fast adapter. Main and explicitly labeled
                    PRs add E2E, Storybook, link, and performance validation, including
                    Unlighthouse, benchmarks, bundle budgets, and normalized metrics.
                  </p>
                </CardContent>
              </Card>
            </article>
            <article>
              <Card className="dogfood-card">
                <CardContent className="dogfood-card__content">
                  <Braces aria-hidden="true" />
                  <h3>Current contracts</h3>
                  <p>
                    Current capability metadata is generated and validated from workflow YAML. The
                    frozen v1.3 manifest stays untouched so compatibility history cannot drift with
                    <code>main</code>.
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
                    Default-branch pushes build the React reference app and publish{" "}
                    <code>dist/</code>
                    through the <code>deploy-pages.yml</code> Reusable Workflow.
                  </p>
                </CardContent>
              </Card>
            </article>
          </div>
        </section>

        <MetricsSection history={buildMetricsHistory} />

        <section className="section section--split" aria-labelledby="adoption-title">
          <div>
            <p className="eyebrow">New Adoption</p>
            <h2 id="adoption-title">Pin an immutable SHA and delegate validation semantics.</h2>
            <div className="copy">
              <p>
                Private consumers that can access <code>coding-tooling</code> should prefer the
                semantic adapter. Generic or public consumers can pass one repository-owned command
                through <code>fast-validation.yml</code>.
              </p>
              <p>
                Existing v1.3 consumers can keep using the compatibility adoption tool above; it is
                intentionally not the model for new repositories.
              </p>
            </div>
          </div>
          <CodeBlock
            className="code-panel"
            role="region"
            aria-label="Coding-tooling reusable workflow example"
            tabIndex={0}
          >
            <CodeBlockContent>
              <CodeBlockCode>{`jobs:
  validate:
    permissions:
      contents: read
    uses: moritzbrantner/reusable-workflows/.github/workflows/coding-tooling-validation.yml@<immutable-sha>
    with:
      tier: fast
      strict: true`}</CodeBlockCode>
            </CodeBlockContent>
          </CodeBlock>
        </section>

        <section className="section release" id="release" aria-labelledby="release-title">
          <div className="section__heading">
            <p className="eyebrow">Release Discipline</p>
            <h2 id="release-title">Immutable refs are the consumer contract.</h2>
          </div>
          <ol className="release-steps">
            <li>Update the workflow YAML; current capability interfaces are derived from it.</li>
            <li>
              Keep <code>{workflowContracts.workflow_standard}</code> and its historical contract
              snapshot immutable.
            </li>
            <li>
              Run contract validation, app verification, actionlint, and focused smoke coverage.
            </li>
            <li>Confirm affected consumer evidence before broad rollout.</li>
            <li>
              Consumers pin an immutable commit SHA until an intentional capability-specific release
              tag exists.
            </li>
          </ol>
        </section>
      </main>
    </>
  );
}
