import { test as base, type Page } from "@playwright/test";

export { expect } from "@playwright/test";

/**
 * Extends the base test with an `unauthedPage` fixture for tests that
 * need to verify unauthenticated behaviour (e.g. the login page).
 * All other tests use `page` which inherits the global storageState.
 */
export const test = base.extend<{ unauthedPage: Page }>({
  unauthedPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});
