import { Kysely, PostgresDialect, type Generated, Selectable, Insertable } from 'kysely';
import pg from 'pg';


export interface TagsTable {
  id: Generated<number>;
  name: string;
  created_at: Generated<Date>;
}

export interface DisabilityArtifactsTable {
  id: Generated<number>;
  artifact_type: string; // 'csv', 'xlsx', 'image', 'video', 'audio'
  file_path: string;
  file_name: string;
  org_source: string;
  dataset_date: string | null;
  added_at: Generated<Date>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface ArtifactTagsTable {
  artifact_id: number;
  tag_id: number;
}

export interface Database {
  tags: TagsTable;
  disability_artifacts: DisabilityArtifactsTable;
  artifact_tags: ArtifactTagsTable;
}

export type Tag = Selectable<TagsTable>;
export type NewTag = Insertable<TagsTable>;

export type DisabilityArtifact = Selectable<DisabilityArtifactsTable>;
export type NewDisabilityArtifact = Insertable<DisabilityArtifactsTable>;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
});

export async function closeDatabase() {
  await pool.end();
}
