import { test, expect } from "./fixtures.js";

test("dashboard loads for authenticated user", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL("/dashboard");
});
