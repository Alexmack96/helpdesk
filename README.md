# Clam Finance Tracker

Personal finance tracker. Import bank transactions (Monzo, Amex, Barclays, Santander), categorise spending, and track savings goals.

## Stack

- **Server:** Express 5 + Prisma + SQLite (Bun runtime)
- **Client:** React 18 + React Router v6 + Tailwind v4 + shadcn/ui
- **Auth:** Better Auth (server-side sessions)
- **Monorepo:** Bun workspaces (`server/`, `client/`, `core/`)

## Getting Started

```bash
# Install dependencies
bun install

# Apply DB migrations & seed admin user
cd server && bun run db:migrate:deploy && bun run db:seed

# Run dev servers (two terminals, or from root)
bun run dev
```

Client: http://localhost:5173 — API: http://localhost:3000

## Key Commands

```bash
bun run dev                    # start both client and server
cd server && bun run db:studio # Prisma Studio GUI
cd client && bun run test      # component tests (Vitest)
npx playwright test            # e2e tests
```

## Bank Import Flow

1. Upload a CSV on the Import page → rows land in a staging table
2. Hit "Process" → staged rows normalise into `Transaction` records
3. Duplicate `externalId`s are skipped automatically

Supported: Monzo ✓ — Amex, Barclays, Santander, Caseys banks coming soon. 

---

## Todo
[] Verify santander and do the upload for Jan
[] Upload the rest

[] Verify barclays and do the upload

[] Add automated stream of monzo transactions via webhooks :D
[X] **Notes page** — Rename it to Tasks and make a monthly recurring for checking 
[] **Goals page: transaction-only mode** — strip out investment value fluctuations; goals should reflect actual cash moved, not market swings
[] **"In my control" tagging** — mark transactions as outside my control (e.g. a £100 BA charge I don't regret because I made the right call at the time); exclude or surface separately so they don't distort how I feel about spending
[]  Shortcut:  In my VS code user settings, change ctrl+/ to be the shortcut to collapse everything in the VS code explorer window
