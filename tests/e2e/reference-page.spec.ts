import { expect, test } from "@playwright/test";

const workflowSlugs = [
  "deploy-docs-pages",
  "deploy-pages",
  "e2e-validation",
  "external-pull",
  "fast-validation",
  "integration-validation",
  "link-validation",
  "package-publish",
  "performance-validation",
  "promote-branches",
  "release-template",
  "smoke-reusable-workflows",
  "stage-validation",
  "storybook-validation",
  "validate",
  "validate-repo",
];

test("renders the reusable workflow reference page", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /shared ci and release workflow contracts/i }),
  ).toBeVisible();
  await expect(page.locator(".hero").getByText("workflow-standard-v1")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Every workflow has a reference page." }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: "Caller Workflow connection graph" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Deploy Pages" })).toBeVisible();
});

test("keeps workflow connection navigation usable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Connections" }).click();

  await expect(page).toHaveURL(/#connections$/);
  const graph = page.locator('[data-slot="dependency-graph"]');
  await expect(graph.getByText("Validate").first()).toBeVisible();
  await expect(graph.getByText("Deploy Docs Pages")).toBeVisible();
  await expect(graph.getByText("Fast Validation")).toBeVisible();
  await expect(graph.getByText("Deploy Pages")).toBeVisible();
  await expect(graph.getByText("No caller workflow")).toBeVisible();
});

test("keeps dogfood navigation usable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Dogfood" }).click();

  await expect(page).toHaveURL(/#dogfood$/);
  await expect(
    page.getByRole("heading", { name: /uses its own workflow contracts/i }),
  ).toBeVisible();
});

test("keeps metrics navigation usable with the empty fallback history", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Metrics" }).click();

  await expect(page).toHaveURL(/\/metrics$/);
  await expect(
    page.getByRole("heading", { name: "KPI definitions for performance runs." }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "What each metric means." })).toBeVisible();
  await expect(page.getByText("No published build metrics yet.")).toBeVisible();
});

test("links the home metrics summary to KPI definitions", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "KPI definitions" }).click();

  await expect(page).toHaveURL(/\/metrics$/);
  await expect(
    page.getByRole("heading", { name: "KPI definitions for performance runs." }),
  ).toBeVisible();
});

test("renders the adoption generator and checker", async ({ page }) => {
  await page.goto("/adoption");

  await expect(
    page.getByRole("heading", { name: "Generate and audit Caller Workflows." }),
  ).toBeVisible();
  await expect(page.getByLabel("Generated workflow YAML")).toContainText(
    "fast-validation.yml@workflow-standard-v1.3",
  );
  await expect(page.getByLabel("Generated workflow YAML")).toContainText("permissions:");
});

test("changes generated YAML for each common adoption profile", async ({ page }) => {
  await page.goto("/adoption");

  const generatedYaml = page.getByLabel("Generated workflow YAML");

  await page.getByText("Component library", { exact: true }).click();
  await expect(generatedYaml).toContainText("storybook-validation.yml@workflow-standard-v1.3");

  await page.getByText("Package", { exact: true }).click();
  await expect(generatedYaml).toContainText(".github/workflows/publish-package.yml");
  await expect(generatedYaml).toContainText("publish_enabled: false");

  await page.getByText("Pages site", { exact: true }).click();
  await expect(generatedYaml).toContainText(".github/workflows/deploy-pages.yml");

  await page.getByText("Monorepo web app", { exact: true }).click();
  await expect(generatedYaml).toContainText("working_directory: apps/web");

  await page.getByText("Web app", { exact: true }).click();
  await expect(generatedYaml).toContainText("e2e-validation.yml@workflow-standard-v1.3");
});

test("reports adoption warnings for pasted workflow YAML", async ({ page }) => {
  await page.goto("/adoption");

  await page.getByLabel("Workflow YAML to audit").fill(`name: Validate
jobs:
  fast:
    uses: moritzbrantner/reusable-workflows/.github/workflows/fast-validation.yml@main
    secrets: inherit
`);

  await expect(page.getByText("moving-workflow-ref")).toBeVisible();
  await expect(page.getByText("inherited-secrets")).toBeVisible();
  await expect(page.getByText("missing-job-permissions")).toBeVisible();
});

test("renders latest build metrics and the last-5 table from a fixture history", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.buildMetricsHistoryFixture = {
      schemaVersion: 1,
      generatedAt: "2026-06-07T12:30:00.000Z",
      source: "github-actions",
      limit: 5,
      builds: Array.from({ length: 5 }, (_, index) => {
        const runNumber = 105 - index;

        return {
          id: `${runNumber}-1`,
          runId: runNumber,
          runNumber,
          runAttempt: 1,
          event: "push",
          branch: "main",
          commitSha: "1234567890abcdef",
          commitShortSha: `abcde${index}`,
          commitUrl: `https://github.com/moritzbrantner/reusable-workflows/commit/1234567890abcdef`,
          runUrl: `https://github.com/moritzbrantner/reusable-workflows/actions/runs/${runNumber}/attempts/1`,
          startedAt: "2026-06-07T12:00:00.000Z",
          completedAt: `2026-06-07T12:${25 - index}:00.000Z`,
          status: "success",
          durations: { buildMs: 1200 + index * 100 },
          bundle: { jsBytes: 128000 + index * 1000, budgetBytes: 358400, withinBudget: true },
          benchmark: {
            name: "workflow-contract-json-roundtrip",
            durationMs: 600 + index,
            iterations: 10000,
            operationsPerSecond: 15000 - index * 100,
          },
          lighthouse: {
            score: 0.95 - index * 0.01,
            categories: {
              performance: 0.93,
              accessibility: 1,
              bestPractices: 0.96,
              seo: 0.91,
            },
            metrics: {
              firstContentfulPaintMs: 1200,
              largestContentfulPaintMs: 1350 + index * 10,
              cumulativeLayoutShift: 0,
              totalBlockingTimeMs: 0,
              timeToInteractiveMs: 1350,
              maxPotentialFidMs: 16,
            },
          },
        };
      }),
    };
  });

  await page.goto("/");

  const latestMetrics = page.getByLabel("Latest build metrics");
  await expect(latestMetrics.getByText("Build duration")).toBeVisible();
  await expect(latestMetrics.getByText("JS bundle")).toBeVisible();
  await expect(page.getByRole("img", { name: "Last 5 build metrics trend chart" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Last 5 build metrics" })).toBeVisible();
  await expect(page.getByRole("link", { name: "#105" })).toBeVisible();
  await expect(page.getByRole("link", { name: "#101" })).toBeVisible();

  await page.goto("/metrics");

  await expect(page.getByRole("heading", { name: "What each metric means." })).toBeVisible();
  await expect(page.getByText("Chart value = run build duration")).toBeVisible();
  await expect(page.getByText("performance-results/build.json")).toBeVisible();
  await expect(page.getByRole("img", { name: "Last 5 build metrics trend chart" })).toBeVisible();
});

test("renders workflow detail pages with dependencies and contract data", async ({ page }) => {
  await page.goto("/deploy-pages");

  await expect(page.getByRole("heading", { name: "Deploy Pages" })).toBeVisible();
  await expect(
    page.locator(".workflow-hero__meta").getByText(".github/workflows/deploy-pages.yml"),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "What it uses and who uses it" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Deploy Docs Pages/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Jobs in this workflow" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Inputs" })).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Inputs contract fields" }).getByText("artifact_path"),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Reference snippet" })).toBeVisible();
});

test("links every workflow to a clean path route", async ({ page }) => {
  await page.goto("/");

  const workflowLinks = page.locator(".workflow-card-link");
  await expect(workflowLinks).toHaveCount(workflowSlugs.length);

  const hrefs = await workflowLinks.evaluateAll((links) =>
    links.map((link) => (link as HTMLAnchorElement).getAttribute("href")),
  );

  expect(hrefs).toEqual(expect.arrayContaining(workflowSlugs.map((slug) => `/${slug}`)));
  expect(hrefs.every((href) => href && !href.includes("?workflow="))).toBe(true);
  await expect(page.getByText("Open workflow page")).toHaveCount(0);
  await expect(workflowLinks.getByText("Reusable contract", { exact: true })).toHaveCount(0);
});

test("only shows the uses relationship card when a workflow calls other workflows", async ({
  page,
}) => {
  await page.goto("/deploy-pages");

  await expect(page.getByText("Uses these workflows", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Used by these workflows", { exact: true })).toBeVisible();

  await page.goto("/validate");

  await expect(page.getByText("Uses these workflows", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Fast Validation/ })).toBeVisible();
});

for (const slug of workflowSlugs) {
  test(`serves ${slug} at its clean path`, async ({ page }) => {
    await page.goto(`/${slug}`);

    await expect(
      page.locator(".workflow-hero__meta").getByText(`.github/workflows/${slug}.yml`),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "What it uses and who uses it" })).toBeVisible();
  });
}
