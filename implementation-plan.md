Helpdesk Implementation Plan

Context

Single-org AI-assisted support helpdesk. Customers have accounts.  
 Emails arrive via SendGrid, tickets are auto-classified by Claude. If
≥95% confidence → auto-send a matching canned response (worded to  
 sound natural). Sub-95% → manual review queue for agents. Agents work  
 a dashboard, view AI summaries, edit/send suggested replies. Stack:  
 React + Vite + Tailwind, Express/TS, PostgreSQL + Prisma, SendGrid,  
 Claude API, Docker (monorepo).

---

Phase 1 — Project Scaffolding

Goal: runnable skeleton, no features yet.

1.  Monorepo structure — /frontend, /backend dirs, root package.json  
    with workspaces
2.  Docker Compose — services: postgres, backend, frontend with
    hot-reload volumes
3.  Backend init — Express + TypeScript, ESLint, ts-node-dev, env  
    config via dotenv
4.  Frontend init — Vite + React + TypeScript + Tailwind, React Router  
    skeleton
5.  Prisma init — connect to Postgres, prisma migrate dev runs on  
    container start

---

Phase 2 — Database Schema & Auth

Goal: schema locked down, sessions working, seed admin user.

6.  Prisma schema — models: User, Session, Ticket, TicketMessage,  
    KnowledgeBaseEntry, CannedResponse

- Ticket: status (Open/Resolved/Closed), priority (Low/Medium/High),
  category (GeneralQuestion/TechnicalQuestion/RefundRequest),
  confidenceScore, needsReview bool, customerId FK
- User: role (Admin/Agent), email, passwordHash
- Customer: email, name (separate from staff users)

7.  Session middleware — express-session backed by connect-pg-simple
8.  Auth endpoints — POST /auth/login, POST /auth/logout, GET /auth/me
9.  Auth middleware — requireAuth, requireAdmin route guards
10. Seed script — creates initial admin user

---

Phase 3 — Email Ingestion

Goal: inbound emails create tickets; outbound replies send via
SendGrid.

11. SendGrid inbound parse webhook — POST /webhooks/email/inbound —  
    parse multipart, resolve/create Customer by email, create Ticket +  
    TicketMessage
12. Webhook signature verification — validate SendGrid signed requests
13. Outbound email service — sendEmail(to, subject, body) wrapper
14. Reply endpoint — POST /tickets/:id/reply — saves TicketMessage,  
    sends via SendGrid
15. Reopen on reply — if customer replies to a Closed ticket, reopen  
    to Open

---

Phase 4 — Ticket API (CRUD)

Goal: full REST API for ticket operations.

16. List tickets — GET /tickets — filter: status, priority, category,  
    needsReview; sort by date/priority; pagination
17. Get ticket — GET /tickets/:id — includes messages + customer
18. Update ticket — PATCH /tickets/:id — status, priority, category,  
    assignee
19. Status transitions — enforce Open → Resolved → Closed

---

Phase 5 — AI Features

Goal: Claude classifies, summarises, suggests replies, and
auto-replies.

20. Claude service — typed wrapper around Anthropic SDK, shared prompt
    templates
21. Auto-classification — on ticket creation, Claude returns {
    category, priority, confidenceScore }; stored on Ticket; sets
    needsReview = confidenceScore < 0.95
22. Ticket summary — GET /tickets/:id/summary — Claude summarises  
    thread; cached on ticket record
23. Suggested reply — GET /tickets/:id/suggested-reply — Claude drafts
    reply using top matching KB entries as context
24. Auto-reply pipeline — after classification: if confidenceScore ≥  
    0.95 → find matching CannedResponse by category → send via email, save
    as TicketMessage, set status Resolved

---

Phase 6 — Knowledge Base & Canned Responses

Goal: admins populate the content Claude and auto-reply use.

25. Canned response CRUD — GET/POST/PATCH/DELETE
    /admin/canned-responses (linked to category)
26. KB entry CRUD — GET/POST/PATCH/DELETE /admin/knowledge-base
27. KB injection — top-N KB entries injected into suggested-reply  
    prompt (keyword relevance)

---

Phase 7 — Frontend: Core UI

Goal: agents can triage and respond to tickets end-to-end.

28. Layout + routing — sidebar nav, protected routes, login page
29. Ticket list page — table with filter bar, "Needs Review"
    badge/tab, sort, pagination
30. Ticket detail page — message thread, metadata panel
    (status/priority/category), AI summary panel
31. Reply composer — loads suggested reply, agent can edit, send  
    button
32. Status/priority controls — update inline on detail page

---

Phase 8 — Frontend: Admin

Goal: admins manage users and content.

33. User management page — list, invite, change role, deactivate
34. Canned responses page — CRUD table, grouped by category
35. Knowledge base page — CRUD table

---

Phase 9 — Dashboard

Goal: overview metrics.

36. Stats API — GET /dashboard — counts by status/category, avg  
    resolution time, review queue size
37. Dashboard page — summary cards + simple charts

---

Phase 10 — Hardening & Deploy

Goal: production-ready.

38. Input validation — zod on all API inputs
39. Error handling middleware — consistent JSON error shape
40. Rate limiting — express-rate-limit on auth + webhook routes
41. Prod docker-compose — env secrets, no hot-reload, prisma migrate  
    deploy on start
42. E2E smoke test — inbound email → ticket created → AI classified →  
    canned reply sent

---

Decisions locked in

- Auto-reply = canned response, selected by category match when  
  confidence ≥ 95%
- Sub-95% tickets get needsReview = true, surfaced as a separate queue
- Customers have accounts (email + name), separate from staff users
- Reply to closed ticket → reopens to Open
- Email only (no web form)
- Single org, no multi-tenancy
