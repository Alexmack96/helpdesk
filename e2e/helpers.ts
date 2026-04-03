import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Credentials — sourced from server/.env.test, seeded in global-setup
// ---------------------------------------------------------------------------
export const VALID_EMAIL = "admin@test.com";
export const VALID_PASSWORD = "testpassword123";

// ---------------------------------------------------------------------------
// Page actions
// ---------------------------------------------------------------------------

/** Fill and submit the login form. Does NOT assert the resulting URL — use
 *  `loginAs` when you expect a successful redirect to /dashboard. */
export async function fillLoginForm(page: Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Navigate to /login, submit valid credentials, and wait for /dashboard. */
export async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await fillLoginForm(page, email, password);
  await expect(page).toHaveURL("/dashboard");
}

/** Click the Navbar sign-out button and wait for /logged-out. */
export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/logged-out");
}
