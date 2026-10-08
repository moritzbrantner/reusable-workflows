import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { parsedWorkflowsByFile } from "./app/workflowCatalog";
import { WorkflowPage } from "./pages/WorkflowPage";

test("the promotion detail page provides caller permissions needed for push and dispatch", () => {
  const workflow = parsedWorkflowsByFile.get(".github/workflows/promote-branches.yml");
  if (!workflow) throw new Error("Promotion workflow missing");
  const html = renderToStaticMarkup(<WorkflowPage workflow={workflow} />);
  expect(html).toContain("contents: write");
  expect(html).toContain("actions: write");
});
