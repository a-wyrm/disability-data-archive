import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sql } from 'kysely';
import { db, closeDatabase } from './db/db.js';

const migration = await readFile(resolve('migrations/003_user_cookies.sql'), 'utf8');
await sql.raw(migration).execute(db);

console.log('Database migrations are ready.');
await closeDatabase();
