import { Kysely, PostgresDialect, type Generated } from 'kysely';
import pg from 'pg';

export interface RecordRow {
  id: Generated<number>;
  title: string;
  description: string;
  source: string;
  published_year: number;
  created_at: Generated<Date>;
}

export interface Database {
  records: RecordRow;
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
});

export async function closeDatabase() {
  await pool.end();
}
