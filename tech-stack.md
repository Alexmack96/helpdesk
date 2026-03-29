## Tech Stack

### Frontend
- **React** — UI
- **React Router** — client-side routing
- **Tailwind CSS** — styling
- **Vite** — build tool

### Backend
- **Express.js** (TypeScript) — REST API

### Database
- **PostgreSQL** — primary data store
- **Prisma** — ORM

### Email
- **SendGrid** — inbound parse webhook + outbound sending

### Authentication
- **Database sessions** — server-side sessions stored in PostgreSQL, no JWTs

### Deployment
- **Docker** — containerised deployment (frontend, backend, postgres as separate services via docker-compose)

### AI
- **Anthropic Claude API** — ticket classification, summaries, suggested replies
