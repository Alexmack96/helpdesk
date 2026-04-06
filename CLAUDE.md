# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Express 5 Error Handling

Express 5 automatically forwards async errors to the error handler — no `try/catch` needed for generic propagation. Only use `try/catch` when mapping a specific error to a specific HTTP response (e.g. Prisma `P2002` → 409, CSV parse failure → 400). Never wrap async DB calls in `try/catch` just to `throw err` or call `next(err)`.

## Enums

Always use Prisma-generated enums (e.g. `UserRole.User`, `UserRole.Admin`) instead of hardcoding string literals. Import from `../generated/prisma/index.js`.

## Context7

Always use Context7 (`npx ctx7@latest library <name>` then `npx ctx7@latest docs <id>`) when working with any library, framework, or API in this codebase — Prisma, Express, React, Vite, Tailwind, Zod, Bun, Anthropic SDK, etc.

## Dev Commands

All commands use **Bun** as the runtime/package manager.

### Local development (two terminals)

```bash
# Terminal 1
cd server && bun run dev      # hot-reload via bun --watch

# Terminal 2
cd client && bun run dev      # Vite dev server on :5173
```

Or from repo root:

```bash
bun run dev
```

Database is **SQLite** (`server/prisma/dev.db`) — no external DB process needed.

### Server DB commands

```bash
bun run db:migrate:deploy  # apply existing migrations (use this — migrate dev is interactive)
bun run db:seed            # seed admin user only (no sample data)
bun run db:studio          # Prisma Studio GUI
bun run db:generate        # regenerate Prisma client after schema change
```

**Adding a migration:** `prisma migrate dev` requires an interactive TTY. Instead:
1. Write the SQL manually in `server/prisma/migrations/<timestamp>_<name>/migration.sql`
2. Run `bun run db:migrate:deploy` to apply it
3. Run `bun run db:generate` to regenerate the client

### Lint

```bash
cd server && bun run lint
cd client && bun run lint
```

### Component tests (client)

```bash
cd client && bun run test       # Vitest watch mode
cd client && bunx vitest run    # single run
```

Tests use Vitest + React Testing Library. Setup file: `client/src/test/setup.ts`. Shared helper: `client/src/test/renderWithQuery.tsx`.

### E2E Tests

```bash
npx playwright test          # run all e2e tests
npx playwright test --ui     # interactive UI mode
npx playwright show-report   # view last test report
```

Use the **playwright-e2e-writer** agent for all e2e test authoring. Do not write Playwright tests inline.

## Forms (Client)

Use **React Hook Form** + **Zod** for all forms. Define schemas in `@helpdesk/core` if they're shared with the server; define them locally only if client-only. Wire with `useForm({ resolver: zodResolver(schema) })` and `{...register("field")}`.

## Shared Schemas (`core/`)

`core/` is a third workspace (`@helpdesk/core`) containing Zod schemas shared between server and client.

- `core/src/schemas/` — one file per domain (e.g. `users.ts`)
- `core/src/index.ts` — barrel re-export
- Import: `import { createUserSchema } from "@helpdesk/core"`
- Always add new shared validation schemas here; never duplicate them across server and client.

## Architecture

Bun monorepo with three workspaces: `server/`, `client/`, and `core/`.

### Server (`server/src/`)

Express + TypeScript API. Entry point: `src/index.ts`.

- `config/env.ts` — Zod-validated env vars. Required: `DATABASE_URL`, `SESSION_SECRET`. Optional: SendGrid and Anthropic keys.
- `db/client.ts` — Prisma client singleton.
- `db/seed.ts` — seeds admin user only; no sample transactions.
- `middleware/auth.ts` — `requireAuth` (any session) and `requireAdmin` (role === "Admin").
- `routes/admin.ts` — user list, Monzo CSV import, staging status, process staged.
- `routes/categories.ts` — category CRUD.
- `routes/transactions.ts` — transaction CRUD.
- `routes/dashboard.ts` — summary aggregates for dashboard.

All routes are prefixed and proxied from Vite in dev (see `client/vite.config.ts`).

### Client (`client/src/`)

React 18 + React Router v6 + Tailwind v4 + shadcn/ui. Entry: `main.tsx` → `App.tsx`.

- `main.tsx` — Wraps app in `QueryClientProvider` → `ThemeProvider` → `BrowserRouter`.
- `context/ThemeContext.tsx` — Light/dark theme toggle; persists to `localStorage`; toggles `.dark` on `<html>`.
- `lib/authClient.ts` — Re-exports Better Auth client (`signIn`, `signOut`, `useSession`).
- `lib/api.ts` — Axios instance (`withCredentials: true`). **Always import this for HTTP requests — never use `fetch` directly.**
- `lib/utils.ts` — `cn()` helper (clsx + tailwind-merge).
- `components/ProtectedRoute.tsx` — Route guard; redirects to `/login` if no session.
- `components/AdminRoute.tsx` — Admin-only guard; redirects to `/dashboard` if not Admin.
- `components/Layout.tsx` — Shell with `<Navbar>` + `<Outlet>`; handles sign-out.
- `components/Navbar.tsx` — Green navbar; shows Users + Import links for admins only.
- `components/ui/` — shadcn/ui components (new-york style).
- `pages/LoginPage.tsx` — Email/password login.
- `pages/DashboardPage.tsx` — Summary cards (income/expenses/balance), spending pie chart, transaction table with type/category filters.
- `pages/UsersPage.tsx` — Admin: list all users with role and verification status.
- `pages/ImportPage.tsx` — Admin: upload bank CSV files to staging, process staged rows into transactions.

#### HTTP & Server State

- **Axios** (`client/src/lib/api.ts`) is the only HTTP client. Never use `fetch` directly.
- **TanStack Query v5** manages all server state.
  - GET → `useQuery`; mutations → `useMutation` with `queryClient.invalidateQueries` on success.
  - Query keys: descriptive noun arrays, e.g. `["users"]`, `["transactions", typeFilter, categoryFilter]`.

#### UI / Theming

- Tailwind v4 via `@tailwindcss/vite` plugin (no `tailwind.config.*` file).
- shadcn configured in `client/components.json`; add components with `npx shadcn@latest add <name>`.
- `@` path alias resolves to `client/src/`.
- Theme: green primary (`oklch(0.527 0.154 150.069)`). Dark mode uses deep Wimbledon purple backgrounds (`oklch(0.19 0.07 300)`).
- Icons via `lucide-react`.

Vite proxies `/api`, `/auth`, `/admin`, `/dashboard` → `localhost:3000`.

### Authentication (Better Auth)

Server-side sessions stored in SQLite via the Prisma adapter. No JWT.

**Server config** — `server/src/lib/auth.ts`:
```ts
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "sqlite" }),
  emailAndPassword: { enabled: true, disableSignUp: true },
  user: { additionalFields: { role: { type: "string", defaultValue: "User", input: false } } },
});
```

Sign-up is disabled — new users must be created by an admin.

### Database (Prisma + SQLite)

Key models:

| Model | Purpose |
|---|---|
| `User` | Admin and agent accounts |
| `Category` | Transaction categories with colour |
| `Transaction` | Normalised transactions; `externalId` is namespaced bank ID (`monzo:tx_...`) |
| `MonzoTransaction` | Raw Monzo CSV staging — untouched, one row per CSV row |

### Bank Import Flow

Two-step pipeline: **stage → process**.

1. **Upload** (`POST /api/admin/import/monzo`) — parses CSV into `MonzoTransaction`. Returns `{ imported, duplicates }`. Duplicate `transactionId`s are skipped and listed.
2. **Process** (`POST /api/admin/process`) — reads unprocessed `MonzoTransaction` rows, normalises each to `Transaction` (date parse, Income/Expense split, category upsert), sets `externalId = "monzo:<transactionId>"`.

**Adding a new bank:** add a `<Bank>Transaction` model with that bank's raw CSV columns. Add `POST /api/admin/import/<bank>` with a bank-specific parser. Add `GET /api/admin/staged` count. Add a `BankUploadCard` on `ImportPage`. The process step handles all tables and funnels into `Transaction`.

`externalId` is namespaced (`monzo:tx_...`, `amex:ref_...`) to prevent cross-bank collisions.

Planned banks: Monzo ✓, Amex (coming), Barclays (coming), Santander (coming).
