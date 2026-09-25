import 'dotenv/config';
import { sql } from 'kysely';
import { db, closeDatabase } from './db/db.js';

await sql`
  CREATE TABLE IF NOT EXISTS records (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    source TEXT NOT NULL,
    published_year INTEGER NOT NULL CHECK (published_year BETWEEN 1800 AND 2200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`.execute(db);

console.log('Database is ready.');
await closeDatabase();
