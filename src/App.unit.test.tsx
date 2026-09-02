import { describe, expect, test } from "vitest";

import { adoptionHref, appBasePath, homeHref, metricsHref, workflowHref } from "./App";

describe("app links", () => {
  test("keeps root-hosted workflow links clean", () => {
    expect(appBasePath("/")).toBe("/");
    expect(appBasePath("/deploy-pages")).toBe("/");
    expect(appBasePath("/metrics")).toBe("/");
    expect(homeHref("workflows")).toBe("/#workflows");
    expect(adoptionHref()).toBe("/adoption");
    expect(metricsHref()).toBe("/metrics");
    expect(workflowHref("deploy-pages")).toBe("/deploy-pages");
  });

  test("preserves the GitHub Pages repository base path", () => {
    expect(appBasePath("/reusable-workflows/")).toBe("/reusable-workflows/");
    expect(appBasePath("/reusable-workflows/deploy-pages")).toBe("/reusable-workflows/");
    expect(homeHref("workflows", "/reusable-workflows/deploy-pages")).toBe(
      "/reusable-workflows/#workflows",
    );
    expect(metricsHref("/reusable-workflows/")).toBe("/reusable-workflows/metrics");
    expect(metricsHref("/reusable-workflows/deploy-pages")).toBe("/reusable-workflows/metrics");
    expect(metricsHref("/reusable-workflows/metrics")).toBe("/reusable-workflows/metrics");
    expect(adoptionHref("/reusable-workflows/metrics")).toBe("/reusable-workflows/adoption");
    expect(workflowHref("deploy-pages", "/reusable-workflows/")).toBe(
      "/reusable-workflows/deploy-pages",
    );
  });
});
