---
name: E2E test conventions and infrastructure
description: Existing e2e setup: fixture pattern, auth state, global setup/teardown, test credentials
type: project
---

Fixtures at `e2e/fixtures.ts` extend base `test` with an `unauthedPage` fixture (fresh browser context, no storage state). Tests that need a logged-in user use the default `page` fixture, which inherits global `storageState: "e2e/.auth/user.json"`.

Global setup (`e2e/global-setup.ts`) runs migrations, seeds the test DB, then logs in via `POST /api/auth/sign-in/email` and writes session cookies to `e2e/.auth/user.json`. Global teardown truncates the test DB.

Test credentials come from `server/.env.test`:
- `ADMIN_EMAIL=admin@test.com`
- `ADMIN_PASSWORD=testpassword123`

Playwright config uses two `webServer` entries: Express on port 3001 (from `testEnv.PORT`) and Vite on 5173. `reuseExistingServer: !process.env.CI`.

Sign-out navigates to `/logged-out` (not `/login`) — Layout calls `navigate("/logged-out")` after `signOut()`. `/logged-out` is a public route.

**Why:** Understand the fixture split to correctly target unauthenticated vs authenticated test flows.
**How to apply:** Use `unauthedPage` for any test starting without a session. Use `page` for tests that need an already-logged-in user.
