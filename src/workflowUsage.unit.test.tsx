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

test("current usage snippets pin an immutable revision instead of the moving main branch", () => {
  const workflow = parsedWorkflowsByFile.get(".github/workflows/command-validation.yml");
  if (!workflow) throw new Error("Command validation workflow missing");
  const html = renderToStaticMarkup(<WorkflowPage workflow={workflow} />);
  expect(html).toContain("command-validation.yml@&lt;commit-sha&gt;");
  expect(html).not.toContain("@main");
});
