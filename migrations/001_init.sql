-- Tags table (searchable, reusable)
CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL
);

-- User data table
-- Users can be: super admins, admins, or contributors 
-- Users are given rep based on the amount of artifacts they review
-- can be flagged for actions which can take away rep

CREATE TABLE users (
  user_id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(161) NOT NULL,
  reputation INT NOT NULL DEFAULT 0,
  flag_amount INT NOT NULL DEFAULT 0,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE org_acronym (
  id SERIAL PRIMARY KEY,
  acronym VARCHAR(50) NOT NULL UNIQUE,
  org_full VARCHAR(300) NOT NULL UNIQUE
);


-- insert orgs into org acronym table
INSERT INTO org_acronym (acronym, org_full)
VALUES
  ('CDC',   'Centers for Disease Control and Prevention'),
  ('FDA',   'Food and Drug Administration'),
  ('NIH',   'National Institutes of Health'),
  ('EPA',   'Environmental Protection Agency'),
  ('FBI',   'Federal Bureau of Investigation'),
  ('NASA',  'National Aeronautics and Space Administration'),
  ('NOAA',  'National Oceanic and Atmospheric Administration'),
  ('USDA',  'United States Department of Agriculture'),
  ('HHS',   'Department of Health and Human Services'),
  ('DHS',   'Department of Homeland Security'),
  ('DOJ',   'Department of Justice'),
  ('DOE',   'Department of Energy'),
  ('DOL',   'Department of Labor'),
  ('DOT',   'Department of Transportation'),
  ('HUD',   'Department of Housing and Urban Development'),
  ('VA',    'Department of Veterans Affairs'),
  ('SSA',   'Social Security Administration'),
  ('FEMA',  'Federal Emergency Management Agency'),
  ('FCC',   'Federal Communications Commission'),
  ('FTC',   'Federal Trade Commission'),
  ('SEC',   'Securities and Exchange Commission'),
  ('IRS',   'Internal Revenue Service'),
  ('USPS',  'United States Postal Service'),
  ('NIST',  'National Institute of Standards and Technology'),
  ('NSF',   'National Science Foundation'),
  ('OSHA',  'Occupational Safety and Health Administration');

-- A grouping is the public dataset record. Every artifact belongs to one,
-- including a grouping containing only a single artifact.
CREATE TABLE artifact_grouping (
  dataset_id SERIAL PRIMARY KEY,
  file_name VARCHAR(255) NOT NULL,
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

-- Main artifacts table
CREATE TABLE disability_artifacts (
  id SERIAL PRIMARY KEY,
  artifact_type VARCHAR(50) NOT NULL, -- 'csv', 'xlsx', 'image', 'video', 'audio',
  dataset_id INTEGER NOT NULL REFERENCES artifact_grouping(dataset_id),
  file_path VARCHAR(512) NOT NULL, -- local path or S3 URL
  file_name VARCHAR(255) NOT NULL,
  reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  org_id VARCHAR(50) NOT NULL REFERENCES org_acronym(acronym),
  dataset_date VARCHAR(100),
  added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dataset_description VARCHAR(12000),
  dataset_kind VARCHAR(300),
  dataset_status VARCHAR(20)
);

-- artifacts review table
CREATE TABLE artifacts_review (
  review_id SERIAL PRIMARY KEY,
  artifact_id INTEGER NOT NULL REFERENCES disability_artifacts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(user_id),
  review_status VARCHAR(20) NOT NULL CHECK (review_status IN ('approved', 'denied')),
  review_ratings INT

);

CREATE TABLE review_comments (
    comment_id SERIAL PRIMARY KEY,
    artifact_id INTEGER NOT NULL REFERENCES disability_artifacts(id) ON DELETE CASCADE,
    parent_comment_id INTEGER REFERENCES review_comments(comment_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(user_id),
    comment_text TEXT NOT NULL,
    comment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    edited_at TIMESTAMP
);

-- Many-to-many relationship between artifacts and tags
CREATE TABLE artifact_tags (
  artifact_id INTEGER NOT NULL REFERENCES disability_artifacts(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (artifact_id, tag_id)
);


-- add all disability artifacts to disability artifact table
ALTER TABLE disability_artifacts
  ADD COLUMN IF NOT EXISTS dataset_id INTEGER;
ALTER TABLE disability_artifacts
  ADD COLUMN IF NOT EXISTS reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS file_name VARCHAR(255),
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
