ALTER TABLE lesson_attempts
  ADD COLUMN lesson_version INTEGER NOT NULL DEFAULT 1
  CHECK (lesson_version > 0);
