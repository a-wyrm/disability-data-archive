import { Kysely, PostgresDialect, type Generated, Selectable, Insertable } from 'kysely';
import pg from 'pg';


export interface TagsTable {
  id: Generated<number>;
  name: string;
  created_at: Generated<Date>;
}

export interface OrgTable {
  id: Generated<number>;
  acronym: string;
  org_full: string;
}

export interface DisabilityArtifactsTable {
  id: Generated<number>;
  artifact_type: string; // 'csv', 'xlsx', 'image', 'video', 'audio'
  file_path: string;
  file_name: string;
  org_id: string;
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

export interface ReviewCommentsTable {
  comment_id: Generated<number>;
  artifact_id: number;
  parent_comment_id: number | null;
  user_id: number;
  comment_text: string;
  comment_date: Generated<Date>;
  edited_at: Date | null;
}

export interface Database {
  tags: TagsTable;
  org_acronym: OrgTable;
  disability_artifacts: DisabilityArtifactsTable;
  artifact_tags: ArtifactTagsTable;
  users: UsersTable;
  artifacts_review: ArtifactsReviewTable;
  review_comments: ReviewCommentsTable;
}

export type Tag = Selectable<TagsTable>;
export type NewTag = Insertable<TagsTable>;
export type Organization = Selectable<OrgTable>;

export type DisabilityArtifact = Selectable<DisabilityArtifactsTable>;
export type NewDisabilityArtifact = Insertable<DisabilityArtifactsTable>;
export type User = Selectable<UsersTable>;
export type ReviewComment = Selectable<ReviewCommentsTable> & { username: string };

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
});

export async function closeDatabase() {
  await pool.end();
}
