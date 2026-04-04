# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Context7

Always use Context7 MCP (`resolve-library-id` then `query-docs`) when working with any library, framework, or API in this codebase — Prisma, Express, React,  Vite, Tailwind, Zod, Bun, Anthropic SDK, etc.

## Dev Commands

All commands use **Bun** as the runtime/package manager.

### Local development (two terminals)

```bash
# Terminal 1
cd server && bun run dev      # hot-reload via bun --watch

# Terminal 2
cd client && bun run dev      # Vite dev server on :5173
```

Or from repo root (coupled, single terminal):

```bash
bun run dev
```

Postgres must be running. It is installed on my local machine, we are not spinning one up in docker.

### Server DB commands

```bash
bun run db:migrate        # create + apply new migration (dev)
bun run db:migrate:deploy # apply existing migrations (prod/CI)
bun run db:seed           # seed the database
bun run db:studio         # Prisma Studio GUI
bun run db:generate       # regenerate Prisma client after schema change
```

### Lint

```bash
cd server && bun run lint
cd client && bun run lint
```

### E2E Tests

```bash
npx playwright test          # run all e2e tests
npx playwright test --ui     # interactive UI mode
npx playwright show-report   # view last test report
```

## Testing

Use the **playwright-e2e-writer** agent for all e2e test authoring — after building a new page or flow, when adding API endpoints that need coverage, or when explicitly asked to write tests. Do not write Playwright tests inline; delegate to the agent.

## Architecture

Bun monorepo with two workspaces: `server/` and `client/`.

### Server (`server/src/`)

Express + TypeScript API. Entry point: `src/index.ts`.

- `config/env.ts` — Zod-validated env vars. Required: `DATABASE_URL`, `SESSION_SECRET`. Optional: SendGrid and Anthropic keys.
- `db/client.ts` — Prisma client singleton.
- `middleware/auth.ts` — Session-based auth guards (agent vs admin).
- `routes/` — `auth`, `tickets`, `admin`, `dashboard`, `webhooks` (SendGrid inbound).

All routes are prefixed and proxied from Vite in dev (see `client/vite.config.ts`).

### Client (`client/src/`)

React 18 + React Router v6 + Tailwind v4 + shadcn/ui. Entry: `main.tsx` → `App.tsx`.

- `main.tsx` — Wraps app in `QueryClientProvider` → `ThemeProvider` → `BrowserRouter`.
- `context/ThemeContext.tsx` — Light/dark theme toggle; persists to `localStorage`; toggles `.dark` on `<html>`.
- `context/AuthContext.tsx` — Global auth state via Better Auth (`useSession`).
- `lib/authClient.ts` — Re-exports Better Auth client (`signIn`, `signOut`, `useSession`).
- `lib/api.ts` — Axios instance (`withCredentials: true`). **Always import this for HTTP requests — never use `fetch` directly.**
- `lib/utils.ts` — `cn()` helper (clsx + tailwind-merge).
- `components/ProtectedRoute.tsx` — Route guard; redirects to `/login` if no session.
- `components/Layout.tsx` — Shell with `<Navbar>` + `<Outlet>`; handles sign-out.
- `components/Navbar.tsx` — Green navbar with health status, user name, dark-mode toggle, sign-out.
- `components/ui/` — shadcn/ui components (new-york style): `button`, `card`, `input`, `label`.
- `pages/LoginPage.tsx` — Email/password login using shadcn Card/Input/Button + React Hook Form + Zod.
- `pages/DashboardPage.tsx` — Placeholder welcome page.

#### HTTP & Server State

- **Axios** (`client/src/lib/api.ts`) is the only HTTP client. Never use `fetch` directly.
- **TanStack Query v5** (`@tanstack/react-query`) manages all server state.
  - GET requests → `useQuery`; mutations (POST/PUT/PATCH/DELETE) → `useMutation` with `queryClient.invalidateQueries` on success.
  - `QueryClientProvider` is mounted at the root in `main.tsx`.
  - Query keys: use descriptive noun arrays, e.g. `["users"]`, `["transactions", typeFilter, categoryFilter]`.

#### UI / Theming

- Tailwind v4 via `@tailwindcss/vite` plugin (no `tailwind.config.*` file).
- shadcn configured in `client/components.json`; add components with `npx shadcn@latest add <name>`.
- `@` path alias resolves to `client/src/`.
- Theme: green primary (`oklch(0.527 0.154 150.069)`). Dark mode uses deep Wimbledon purple backgrounds (`oklch(0.19 0.07 300)`).
- Icons via `lucide-react`.

Vite proxies `/api`, `/auth`, `/tickets`, `/admin`, `/dashboard`, `/webhooks` → `localhost:3000`.

### Authentication (Better Auth)

Auth is handled entirely by [Better Auth](https://better-auth.com) with database-backed sessions stored in Postgres via the Prisma adapter. There is no JWT — sessions are server-side.

**Server config** — `server/src/lib/auth.ts`:

```ts
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: { enabled: true, disableSignUp: true }, // admins create users manually
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: UserRole.Agent, input: false },
    },
  },
});
```

Better Auth mounts its own route handler in `server/src/index.ts`:

```ts
app.all("/api/auth/*", toNodeHandler(auth)); // handles login, logout, session refresh, etc.
```

**Protecting routes** — `server/src/middleware/auth.ts` exports two Express middlewares:

```ts
requireAuth; // any logged-in user
requireAdmin; // role === "Admin" only
```

Both call `auth.api.getSession({ headers: fromNodeHeaders(req.headers) })` and attach `req.user` / `req.session` for downstream handlers.

**Client** — `client/src/lib/authClient.ts`:

```ts
export const { signIn, signOut, useSession } = createAuthClient();
```

- `useSession()` — React hook; returns `{ data: session | null, isPending }`.
- `signIn.email({ email, password })` — returns `{ error }` on failure.
- `signOut()` — clears the session cookie.

`ProtectedRoute.tsx` uses `useSession()` to gate routes — redirects to `/login` while `isPending`, then to `/login` if no session.

Sign-up is **disabled** (`disableSignUp: true`). New users must be created by an admin (seed script or future admin UI).

### Database (Prisma + PostgreSQL)

Key models: `User` (agents/admins), `Customer` (end-users), `Ticket`, `TicketMessage`, `CannedResponse`, `KnowledgeBaseEntry`.

Tickets have `confidenceScore` and `needsReview` fields used by AI classification logic.

### AI / Email flow

- Inbound emails arrive via SendGrid webhook → `routes/webhooks.ts`
- Claude (`@anthropic-ai/sdk`) classifies tickets, generates summaries, and suggests replies
- ≥95% confidence → auto-reply using matched canned response; <95% → flagged for agent review
