import { describe, expect, test } from "vitest";

import { appBasePath, homeHref, workflowHref } from "./App";

describe("app links", () => {
  test("keeps root-hosted workflow links clean", () => {
    expect(appBasePath("/")).toBe("/");
    expect(appBasePath("/deploy-pages")).toBe("/");
    expect(homeHref("workflows")).toBe("/#workflows");
    expect(workflowHref("deploy-pages")).toBe("/deploy-pages");
  });

  test("preserves the GitHub Pages repository base path", () => {
    expect(appBasePath("/reusable-workflows/")).toBe("/reusable-workflows/");
    expect(appBasePath("/reusable-workflows/deploy-pages")).toBe("/reusable-workflows/");
    expect(homeHref("workflows", "/reusable-workflows/deploy-pages")).toBe(
      "/reusable-workflows/#workflows",
    );
    expect(workflowHref("deploy-pages", "/reusable-workflows/")).toBe(
      "/reusable-workflows/deploy-pages",
    );
  });
});
