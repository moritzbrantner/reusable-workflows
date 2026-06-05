import { expect, test } from "@playwright/test";

test("renders a non-empty first viewport", async ({ page }) => {
  await page.goto("/");

  const hero = page.locator(".hero");
  await expect(hero).toBeVisible();

  const box = await hero.boundingBox();
  expect(box?.width).toBeGreaterThan(300);
  expect(box?.height).toBeGreaterThan(300);
});
