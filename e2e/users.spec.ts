/**
 * Users page e2e coverage
 *
 * Create User — happy path:
 *   - Clicking "Create User" opens the dialog
 *   - Filling name, email, password and submitting creates the user
 *   - Modal closes and the new user appears in the table
 *
 * Preconditions:
 *   - global-setup seeds the DB and writes e2e/.auth/user.json (admin session)
 *   - `page` fixture carries stored admin auth state
 */

import { test, expect } from "./fixtures.js";

test.describe("Users — create user", () => {
  test("creates a new user and shows them in the table", async ({ page }) => {
    const email = `newuser-${Date.now()}@example.com`;

    await page.goto("/users");

    await page.getByRole("button", { name: "Create User" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Name").fill("Test Newuser");
    await dialog.getByLabel("Email").fill(email);
    await dialog.getByLabel("Password").fill("password123");

    await dialog.getByRole("button", { name: "Create User" }).click();

    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("cell", { name: "Test Newuser" })).toBeVisible();
  });
});
