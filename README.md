# Disability Data Archive


## Run with Docker

```bash
docker compose up -d
docker compose up --build
```

Open http://localhost:3000. PostgreSQL is initialized from `migrations/001_init.sql`.

## Run locally

Requirements: Node.js 22+ and PostgreSQL.

```bash
npm install
copy .env.example .env
npm run db:migrate
npm run dev
```

While `npm run dev` is running, edits under `src/` restart Hono and automatically reload any open browser page.

The app exposes:

- `GET /` for the archive page
- `GET /records?q=...` for the HTMX search fragment
- `GET /health` for a health check

