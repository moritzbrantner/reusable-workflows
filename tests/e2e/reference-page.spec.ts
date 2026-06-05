import { expect, test } from "@playwright/test";

test("renders the reusable workflow reference page", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /shared ci and release contracts/i }),
  ).toBeVisible();
  await expect(page.locator(".hero").getByText("workflow-standard-v1")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "What each reusable workflow owns" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Deploy Pages" })).toBeVisible();
});

test("keeps dogfood navigation usable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Dogfood" }).click();

  await expect(page).toHaveURL(/#dogfood$/);
  await expect(
    page.getByRole("heading", { name: /uses its own workflow contracts/i }),
  ).toBeVisible();
});
