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
  reviewed: boolean;
  dataset_date: string | null;
  added_at: Generated<Date>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface ArtifactTagsTable {
  artifact_id: number;
  tag_id: number;
}

export interface UsersTable {
  user_id: Generated<number>;
  username: string;
  email: string;
  password_hash: string;
  reputation: Generated<number>;
  flag_amount: Generated<number>;
  is_locked: Generated<boolean>;
  created_at: Generated<Date>;
}

export interface ArtifactsReviewTable {
  review_id: Generated<number>;
  artifact_id: number;
  user_id: number;
  review_status: 'approved' | 'denied';
  review_ratings: number | null;
}

export interface Database {
  tags: TagsTable;
  disability_artifacts: DisabilityArtifactsTable;
  artifact_tags: ArtifactTagsTable;
  users: UsersTable;
  artifacts_review: ArtifactsReviewTable;
}

export type Tag = Selectable<TagsTable>;
export type NewTag = Insertable<TagsTable>;

export type DisabilityArtifact = Selectable<DisabilityArtifactsTable>;
export type NewDisabilityArtifact = Omit<Insertable<DisabilityArtifactsTable>, 'reviewed'>;
export type User = Selectable<UsersTable>;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
});

export async function closeDatabase() {
  await pool.end();
}
