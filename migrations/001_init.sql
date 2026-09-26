-- Tags table (searchable, reusable)
CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL
);

-- Main artifacts table
CREATE TABLE disability_artifacts (
  id SERIAL PRIMARY KEY,
  artifact_type VARCHAR(50) NOT NULL, -- 'csv', 'xlsx', 'image', 'video', 'audio'
  file_path VARCHAR(512) NOT NULL, -- local path or S3 URL
  file_name VARCHAR(255) NOT NULL,
  org_source VARCHAR(255) NOT NULL,
  dataset_date VARCHAR(100), -- nullable; can be "unknown", "2024-01", "2023", etc.
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Many-to-many: artifacts to tags
-- when deleted cascade down
CREATE TABLE artifact_tags (
  artifact_id INT REFERENCES disability_artifacts(id) ON DELETE CASCADE,
  tag_id INT REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (artifact_id, tag_id)
);

-- Indexes for search performance
CREATE INDEX idx_artifact_type ON disability_artifacts(artifact_type);
CREATE INDEX idx_org_source ON disability_artifacts(org_source);
CREATE INDEX idx_tag_name ON tags(name);
CREATE INDEX idx_csv_artifact ON csv_data(artifact_id);
