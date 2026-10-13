ALTER TABLE review_comments
  ADD COLUMN IF NOT EXISTS artifact_id INTEGER;

ALTER TABLE review_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id INTEGER;

ALTER TABLE review_comments
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP;

UPDATE review_comments AS comments
SET artifact_id = reviews.artifact_id
FROM artifacts_review AS reviews
WHERE comments.review_id = reviews.review_id AND comments.artifact_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'review_comments_artifact_id_fkey'
  ) THEN
    ALTER TABLE review_comments
      ADD CONSTRAINT review_comments_artifact_id_fkey
      FOREIGN KEY (artifact_id) REFERENCES disability_artifacts(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'review_comments_parent_comment_id_fkey'
  ) THEN
    ALTER TABLE review_comments
      ADD CONSTRAINT review_comments_parent_comment_id_fkey
      FOREIGN KEY (parent_comment_id) REFERENCES review_comments(comment_id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE review_comments
  ALTER COLUMN artifact_id SET NOT NULL,
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN comment_text SET NOT NULL;

ALTER TABLE review_comments DROP CONSTRAINT IF EXISTS review_comments_review_id_fkey;

ALTER TABLE review_comments DROP COLUMN IF EXISTS review_id;
