import { workflowHref } from "../app/routes";
import type { ParsedWorkflow } from "../app/types";
import { Card, CardContent } from "./ui";

export function WorkflowIndex({
  showContractMetrics = true,
  title,
  workflows,
}: {
  showContractMetrics?: boolean;
  title: string;
  workflows: ParsedWorkflow[];
}) {
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
                    {showContractMetrics ? (
                      <div>
                        <dt>Inputs</dt>
                        <dd>{Object.keys(workflow.contract?.inputs ?? {}).length}</dd>
                      </div>
                    ) : null}
                    {workflow.dependencies.length > 0 ? (
                      <div>
                        <dt>Uses</dt>
                        <dd>{workflow.dependencies.length}</dd>
                      </div>
                    ) : null}
                    {showContractMetrics ? (
                      <div>
                        <dt>Callers</dt>
                        <dd>{workflow.callers.length}</dd>
                      </div>
                    ) : null}
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
