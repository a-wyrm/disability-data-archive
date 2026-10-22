# Disability Data Archive

This is the repository for the disability data archive run by the American Association of People with Disabilities.
All webpages are run server-side. 

## Run with Docker

```bash
docker compose up -d
docker compose up --build
```

Open http://localhost:3000. PostgreSQL is initialized from `migrations/001_init.sql`.

For databases initialized before review comments were added, apply
`migrations/002_review_comments.sql` after the initial schema.

For databases initialized before persistent login sessions were added, apply
`migrations/003_user_cookies.sql` after the initial schema.

The Docker Compose app connects to PostgreSQL using the `db` service name. The `db` hostname is only available inside the Compose network. For commands run directly on your host, set `DATABASE_URL` in `.env` to use `localhost` instead.

To open a PostgreSQL shell in the Docker database:

```bash
docker exec -it backend psql -U archive -d disability_archive
```

Uploaded files are stored in the directory configured by `UPLOAD_DIRECTORY`.
The default is `uploads` relative to the directory where the app is started.
For local development, set `UPLOAD_DIRECTORY=./uploads` in `.env`.

The `archive` role comes from `DB_USERNAME` in `.env`; if you change that value after the database volume has been initialized, the existing volume keeps the original role.

## Run locally

Requirements: Node.js 22+ and PostgreSQL.

```bash
npm install
copy .env.example .env
npm run db:migrate
npm run dev
```

To insert the dummy data while running the script on your host, use the host database URL:

```bash
npm run data
```

If `.env` currently uses `@db:5432`, change it to `@localhost:5432` before running that command. Alternatively, run the script inside the app container, where `db` is available:

```bash
docker exec frontend npm run data
```

If the database volume was created before `artifact_tags` was added to the schema, create that table once:

```bash
docker exec -i backend psql -U archive -d disability_archive -c "CREATE TABLE IF NOT EXISTS artifact_tags (artifact_id INTEGER NOT NULL REFERENCES disability_artifacts(id) ON DELETE CASCADE, tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY (artifact_id, tag_id));"
```

While `npm run dev` is running, edits under `src/` restart Hono and automatically reload any open browser page.


To run on pgAdmin:

- host.docker.internal
