-- v1.9.23 add project cover image for progress hero
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS cover_image VARCHAR(500) NOT NULL DEFAULT '';
