import { buildMetricsHistory } from "./app/metricsCatalog";
import {
  adoptionHref,
  appBasePath,
  homeHref,
  metricsHref,
  standalonePageFromPath,
  slugFromPath,
  workflowHref,
} from "./app/routes";
import { parsedWorkflows, parsedWorkflowsBySlug } from "./app/workflowCatalog";
import { AdoptionPage } from "./pages/AdoptionPage";
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

  if (selectedPage === "adoption") {
    return <AdoptionPage />;
  }

  if (selectedWorkflow) {
    return <WorkflowPage workflow={selectedWorkflow} />;
  }

  return <HomePage />;
}

export { App, adoptionHref, appBasePath, homeHref, metricsHref, parsedWorkflows, workflowHref };
