import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("has no obvious accessibility violations on the reference page", async ({ page }) => {
  await page.goto("/");

  const results = await new AxeBuilder({ page }).analyze();

  expect(results.violations).toEqual([]);
});

test("has no obvious accessibility violations on the metrics page", async ({ page }) => {
  await page.goto("/metrics");

  const results = await new AxeBuilder({ page }).analyze();

  expect(results.violations).toEqual([]);
});

test("has no obvious accessibility violations on the adoption page", async ({ page }) => {
  await page.goto("/adoption");

  const results = await new AxeBuilder({ page }).analyze();

  expect(results.violations).toEqual([]);
});
