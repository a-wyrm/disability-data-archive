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

