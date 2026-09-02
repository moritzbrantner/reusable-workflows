import { ArrowLeft } from "lucide-react";

import workflowContracts from "../../contracts/workflows.json";
import { formatValue } from "../app/formatters";
import { homeHref, workflowHref } from "../app/routes";
import { parsedWorkflowsByFile } from "../app/workflowCatalog";
import type { ContractField, ParsedWorkflow } from "../app/types";
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
  Stat,
  StatDescription,
  StatValue,
} from "../components/ui";
import { SiteHeader } from "../components/SiteHeader";

export function WorkflowPage({ workflow }: { workflow: ParsedWorkflow }) {
  const compatibilityContract = workflow.contract;
  const isReusableWorkflow = workflow.triggers.includes("workflow_call");
  const workflowRole = isReusableWorkflow ? "Reusable Workflow" : "Caller Workflow";
  const dependencyWorkflows = workflow.dependencies
    .map((file) => parsedWorkflowsByFile.get(file))
    .filter((dependency): dependency is ParsedWorkflow => Boolean(dependency));
  const callerWorkflows = workflow.callers
    .map((file) => parsedWorkflowsByFile.get(file))
    .filter((caller): caller is ParsedWorkflow => Boolean(caller));
  const showDependencyCard = workflowRole === "Caller Workflow" || dependencyWorkflows.length > 0;
  const usageSnippet = buildCurrentUsageSnippet(workflow, workflowRole);

  return (
    <>
      <SiteHeader />
      <main id="top">
        <section className="workflow-hero" aria-labelledby="workflow-title">
          <div className="workflow-hero__body">
            <a className="back-link" href={homeHref("workflows")}>
              <ArrowLeft aria-hidden="true" />
              All capabilities
            </a>
            <p className="eyebrow">{workflowRole}</p>
            <h1 id="workflow-title">{workflow.title}</h1>
            <p className="hero__lede">{workflow.summary}</p>
            <div className="workflow-hero__meta" aria-label="Workflow metadata">
              <Badge>{workflow.file}</Badge>
              <Badge variant="secondary">{workflow.yamlName}</Badge>
              <Badge variant="outline">Current main</Badge>
              {compatibilityContract ? (
                <Badge variant="outline">{workflowContracts.workflow_standard} snapshot</Badge>
              ) : isReusableWorkflow ? (
                <Badge variant="outline">Independent capability</Badge>
              ) : null}
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
                {compatibilityContract
                  ? Object.keys(compatibilityContract.inputs ?? {}).length
                  : isReusableWorkflow
                    ? "YAML"
                    : "—"}
              </StatValue>
              <StatDescription className="signal-board__stat-description">
                {compatibilityContract
                  ? "v1.3 inputs"
                  : isReusableWorkflow
                    ? "Current contract"
                    : "Workflow call"}
              </StatDescription>
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
                emptyText="This workflow does not call another Reusable Workflow."
                workflows={dependencyWorkflows}
              />
            ) : null}
            <RelationshipCard
              title="Used by these workflows"
              emptyText="No Caller Workflow currently calls this workflow."
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
            <h2 id="contract-title">
              {compatibilityContract ? "Frozen compatibility snapshot" : "Current contract source"}
            </h2>
          </div>
          {compatibilityContract ? (
            <div className="workflow-detail-stack">
              <Card className="detail-card">
                <CardHeader>
                  <CardTitle>{workflowContracts.workflow_standard}</CardTitle>
                  <CardDescription>
                    Historical compatibility data, not the live main contract.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p>
                    The structured fields below come from <code>contracts/workflows.json</code>,
                    which is intentionally frozen. Consult the current workflow YAML for the live
                    capability interface before adopting or changing a caller.
                  </p>
                </CardContent>
              </Card>
              <ContractFields title="Inputs" fields={compatibilityContract.inputs} />
              <ContractFields title="Secrets" fields={compatibilityContract.secrets ?? {}} />
              <ContractFields title="Outputs" fields={compatibilityContract.outputs ?? {}} />
              <PermissionFields permissions={compatibilityContract.permissions} />
            </div>
          ) : (
            <Card className="detail-card">
              <CardContent>
                {isReusableWorkflow ? (
                  <p>
                    This is an independent current capability. Its <code>workflow_call</code>{" "}
                    inputs, secrets, outputs, and job permissions are defined by the current YAML on
                    <code>main</code>; it is intentionally absent from the frozen v1.3 compatibility
                    manifest.
                  </p>
                ) : (
                  <p>
                    This is a repository-owned Caller Workflow. It has no reusable
                    <code>workflow_call</code> contract; its current YAML defines lifecycle triggers
                    and composition.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </section>

        <section className="section section--split" aria-labelledby="usage-title">
          <div>
            <p className="eyebrow">Usage</p>
            <h2 id="usage-title">Current-line reference snippet</h2>
            {isReusableWorkflow ? (
              <p>
                Pin an immutable commit SHA. Check the current YAML for capability-specific inputs;
                do not infer the current interface from the frozen v1.3 snapshot.
              </p>
            ) : null}
          </div>
          <CodeBlock
            className="code-panel"
            role="region"
            aria-label={`${workflow.title} usage example`}
            tabIndex={0}
          >
            <CodeBlockContent>
              <CodeBlockCode>{usageSnippet}</CodeBlockCode>
            </CodeBlockContent>
          </CodeBlock>
        </section>
      </main>
    </>
  );
}

function buildCurrentUsageSnippet(
  workflow: ParsedWorkflow,
  workflowRole: "Reusable Workflow" | "Caller Workflow",
) {
  if (workflowRole === "Caller Workflow") {
    return `# ${workflow.file}\n# This is a repository-owned Caller Workflow.\n# It invokes:\n${
      workflow.dependencies.map((dependency) => `# - ${dependency}`).join("\n") ||
      "# - no invoked Reusable Workflows"
    }`;
  }

  return `jobs:\n  ${workflow.slug}:\n    permissions:\n      contents: read\n    uses: moritzbrantner/reusable-workflows/${workflow.file}@<immutable-sha>\n    with:\n      # pass inputs from the current workflow YAML`;
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
