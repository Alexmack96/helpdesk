# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Context7

Always use Context7 MCP (`resolve-library-id` then `query-docs`) when working with any library, framework, or API in this codebase — Prisma, Express, React, Vite, Tailwind, Zod, Bun, SendGrid, Anthropic SDK, etc.

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

Postgres must be running. Start it alone via Docker if needed:
```bash
docker compose up postgres -d
```

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

## Architecture

Bun monorepo with two workspaces: `server/` and `client/`.

### Server (`server/src/`)
Express + TypeScript API. Entry point: `src/index.ts`.

- `config/env.ts` — Zod-validated env vars. Required: `DATABASE_URL`, `SESSION_SECRET`. Optional: SendGrid and Anthropic keys.
- `db/client.ts` — Prisma client singleton.
- `middleware/auth.ts` — Session-based auth guards (agent vs admin).
- `routes/` — `auth`, `tickets`, `admin`, `dashboard`, `webhooks` (SendGrid inbound).

Session persistence uses `connect-pg-simple` (sessions stored in Postgres).

All routes are prefixed and proxied from Vite in dev (see `client/vite.config.ts`).

### Client (`client/src/`)
React 18 + React Router v6 + Tailwind. Entry: `main.tsx` → `App.tsx`.

- `context/AuthContext.tsx` — Global auth state; fetches `/api/me` on load.
- `components/ProtectedRoute.tsx` / `AdminRoute.tsx` — Route guards wrapping React Router `<Outlet>`.
- `pages/admin/` — User management, canned responses, knowledge base (admin-only routes).

Vite proxies `/api`, `/auth`, `/tickets`, `/admin`, `/dashboard`, `/webhooks` → `localhost:3000`.

### Database (Prisma + PostgreSQL)
Key models: `User` (agents/admins), `Customer` (end-users), `Ticket`, `TicketMessage`, `CannedResponse`, `KnowledgeBaseEntry`.

Tickets have `confidenceScore` and `needsReview` fields used by AI classification logic.

### AI / Email flow
- Inbound emails arrive via SendGrid webhook → `routes/webhooks.ts`
- Claude (`@anthropic-ai/sdk`) classifies tickets, generates summaries, and suggests replies
- ≥95% confidence → auto-reply using matched canned response; <95% → flagged for agent review

### Docker
`docker-compose.yml` defines `postgres`, `server`, `client`. Server runs `prisma migrate deploy && seed` on start. Volumes mount `src/` and `prisma/` for hot-reload inside containers.

For local dev without containers, update `server/.env`:
```
DATABASE_URL=postgresql://helpdesk:helpdesk@localhost:5432/helpdesk
SESSION_SECRET=dev-secret-change-me-in-production
```
