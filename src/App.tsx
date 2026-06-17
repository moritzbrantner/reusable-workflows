import { lazy, Suspense } from "react";

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
import { parsedWorkflowsBySlug } from "./app/workflowCatalog";
import { HomePage } from "./pages/HomePage";

const AdoptionPage = lazy(() =>
  import("./pages/AdoptionPage").then((module) => ({ default: module.AdoptionPage })),
);
const MetricsPage = lazy(() =>
  import("./pages/MetricsPage").then((module) => ({ default: module.MetricsPage })),
);
const WorkflowPage = lazy(() =>
  import("./pages/WorkflowPage").then((module) => ({ default: module.WorkflowPage })),
);

function App() {
  const selectedPage =
    typeof window === "undefined" ? "" : standalonePageFromPath(window.location.pathname);
  const selectedSlug = typeof window === "undefined" ? "" : slugFromPath(window.location.pathname);
  const selectedWorkflow = selectedSlug ? parsedWorkflowsBySlug.get(selectedSlug) : undefined;

  if (selectedPage === "metrics") {
    return (
      <Suspense fallback={<LoadingPage />}>
        <MetricsPage history={buildMetricsHistory} />
      </Suspense>
    );
  }

  if (selectedPage === "adoption") {
    return (
      <Suspense fallback={<LoadingPage />}>
        <AdoptionPage />
      </Suspense>
    );
  }

  if (selectedWorkflow) {
    return (
      <Suspense fallback={<LoadingPage />}>
        <WorkflowPage workflow={selectedWorkflow} />
      </Suspense>
    );
  }

  return <HomePage />;
}

function LoadingPage() {
  return (
    <main className="route-loading" aria-label="Loading page">
      <h1>Loading page</h1>
    </main>
  );
}

export { App, adoptionHref, appBasePath, homeHref, metricsHref, workflowHref };
