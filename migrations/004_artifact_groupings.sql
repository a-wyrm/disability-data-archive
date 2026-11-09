CREATE TABLE IF NOT EXISTS artifact_grouping (
  dataset_id SERIAL PRIMARY KEY, -- dataset id
  org_id VARCHAR(50) NOT NULL REFERENCES org_acronym(acronym),
  reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  dataset_date VARCHAR(100),
  added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dataset_description VARCHAR(12000),
  dataset_kind VARCHAR(300),
  dataset_status VARCHAR(20),
  folder_path VARCHAR(512) 
);

-- add all disability artifacts to disability artifact table
ALTER TABLE disability_artifacts
  ADD COLUMN IF NOT EXISTS dataset_id INTEGER;
ALTER TABLE disability_artifacts
  ADD COLUMN IF NOT EXISTS reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS org_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS dataset_date VARCHAR(100),
  ADD COLUMN IF NOT EXISTS added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS dataset_description VARCHAR(12000),
  ADD COLUMN IF NOT EXISTS dataset_kind VARCHAR(300),
  ADD COLUMN IF NOT EXISTS dataset_status VARCHAR(20);


-- pg_constraint: check, not-null, primary key, unique, foreign key, and exclusion constraints on tables
-- disability_artifacts_dataset_id_fkey: a foreign key that connects to the artifact_grouping
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'disability_artifacts_dataset_id_fkey'
  ) THEN
    ALTER TABLE disability_artifacts
      ADD CONSTRAINT disability_artifacts_dataset_id_fkey
      FOREIGN KEY (dataset_id) REFERENCES artifact_grouping(dataset_id);
  END IF;
END $$;

-- insert artifact into artifact group if there's any legacy items
DO $$
DECLARE
  artifact RECORD;
  new_dataset_id INTEGER;
BEGIN
  FOR artifact IN SELECT * FROM disability_artifacts WHERE dataset_id IS NULL LOOP
    INSERT INTO artifact_grouping (org_id, reviewed, dataset_date, added_at, created_at, updated_at, dataset_description, dataset_kind, dataset_status)
    VALUES (artifact.org_id, artifact.reviewed, artifact.dataset_date, artifact.added_at, 
            artifact.created_at, artifact.updated_at, artifact.dataset_description, 
            artifact.dataset_kind, artifact.dataset_status)
    RETURNING dataset_id INTO new_dataset_id;
    UPDATE disability_artifacts SET dataset_id = new_dataset_id WHERE id = artifact.id;
  END LOOP;
END $$;
