import { buildMetricsHistory } from "./app/metricsCatalog";
import {
  appBasePath,
  homeHref,
  metricsHref,
  standalonePageFromPath,
  slugFromPath,
  workflowHref,
} from "./app/routes";
import { parsedWorkflows, parsedWorkflowsBySlug } from "./app/workflowCatalog";
import { HomePage } from "./pages/HomePage";
import { MetricsPage } from "./pages/MetricsPage";
import { WorkflowPage } from "./pages/WorkflowPage";

function App() {
  const selectedPage =
    typeof window === "undefined" ? "" : standalonePageFromPath(window.location.pathname);
  const selectedSlug = typeof window === "undefined" ? "" : slugFromPath(window.location.pathname);
  const selectedWorkflow = selectedSlug ? parsedWorkflowsBySlug.get(selectedSlug) : undefined;

  if (selectedPage === "metrics") {
    return <MetricsPage history={buildMetricsHistory} />;
  }

  if (selectedWorkflow) {
    return <WorkflowPage workflow={selectedWorkflow} />;
  }

  return <HomePage />;
}

export { App, appBasePath, homeHref, metricsHref, parsedWorkflows, workflowHref };
