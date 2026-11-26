PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS lesson_versions (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  title TEXT NOT NULL,
  level TEXT NOT NULL,
  position INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft','published','archived')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT,
  UNIQUE(lesson_id,version)
);

CREATE INDEX IF NOT EXISTS idx_lesson_versions_lesson_status
  ON lesson_versions(lesson_id,status,version DESC);

CREATE TABLE IF NOT EXISTS question_versions (
  id TEXT PRIMARY KEY,
  lesson_version_id TEXT NOT NULL REFERENCES lesson_versions(id) ON DELETE CASCADE,
  source_question_id TEXT NOT NULL REFERENCES questions(id),
  prompt TEXT NOT NULL,
  options_json TEXT NOT NULL,
  answer_key TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  weight REAL NOT NULL DEFAULT 1 CHECK (weight > 0 AND weight <= 100),
  position INTEGER NOT NULL,
  UNIQUE(lesson_version_id,source_question_id)
);

CREATE INDEX IF NOT EXISTS idx_question_versions_lesson_position
  ON question_versions(lesson_version_id,position);

CREATE TABLE IF NOT EXISTS assessment_policy_versions (
  id TEXT PRIMARY KEY,
  policy_key TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  config_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(policy_key,version)
);

-- Seed version 1 from the existing mutable tables. Existing IDs and history remain intact.
INSERT OR IGNORE INTO lesson_versions
  (id,lesson_id,version,title,level,position,status,created_at,published_at)
SELECT l.id || ':v1',l.id,1,l.title,l.level,l.position,l.status,CURRENT_TIMESTAMP,
       CASE WHEN l.status='published' THEN CURRENT_TIMESTAMP ELSE NULL END
FROM lessons l;

INSERT OR IGNORE INTO question_versions
  (id,lesson_version_id,source_question_id,prompt,options_json,answer_key,explanation,weight,position)
SELECT q.id || ':v1',lv.id,q.id,q.prompt,q.options_json,q.answer_key,q.explanation,1,q.position
FROM questions q
JOIN lesson_versions lv ON lv.lesson_id=q.lesson_id AND lv.version=1;

INSERT OR IGNORE INTO assessment_policy_versions (id,policy_key,version,config_json)
VALUES (
  'percentage-v1',
  'percentage',
  1,
  '{"scoring":"weighted_percentage","unanswered":"incorrect","rounding":"nearest_integer","passThreshold":0}'
);

ALTER TABLE lessons ADD COLUMN current_published_version_id TEXT REFERENCES lesson_versions(id);
UPDATE lessons
SET current_published_version_id = id || ':v1'
WHERE status='published';

ALTER TABLE lesson_attempts ADD COLUMN lesson_version_id TEXT REFERENCES lesson_versions(id);
ALTER TABLE lesson_attempts ADD COLUMN assessment_policy_version_id TEXT REFERENCES assessment_policy_versions(id);
UPDATE lesson_attempts
SET lesson_version_id = lesson_id || ':v1',
    assessment_policy_version_id = 'percentage-v1'
WHERE lesson_version_id IS NULL OR assessment_policy_version_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_attempts_lesson_version
  ON lesson_attempts(lesson_version_id,assessment_policy_version_id);

-- Once published, version rows are immutable. Draft versions can be edited
-- until publication; a new version is required for subsequent content changes.
CREATE TRIGGER IF NOT EXISTS trg_lesson_versions_no_update_published
BEFORE UPDATE ON lesson_versions
WHEN OLD.status='published'
BEGIN
  SELECT RAISE(ABORT,'published lesson versions are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_lesson_versions_no_delete_published
BEFORE DELETE ON lesson_versions
WHEN OLD.status='published'
BEGIN
  SELECT RAISE(ABORT,'published lesson versions cannot be deleted');
END;

CREATE TRIGGER IF NOT EXISTS trg_question_versions_no_insert_published
BEFORE INSERT ON question_versions
WHEN EXISTS (SELECT 1 FROM lesson_versions WHERE id=NEW.lesson_version_id AND status='published')
BEGIN
  SELECT RAISE(ABORT,'cannot add questions to a published lesson version');
END;

CREATE TRIGGER IF NOT EXISTS trg_question_versions_no_update_published
BEFORE UPDATE ON question_versions
WHEN EXISTS (SELECT 1 FROM lesson_versions WHERE id=OLD.lesson_version_id AND status='published')
BEGIN
  SELECT RAISE(ABORT,'published question versions are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_question_versions_no_delete_published
BEFORE DELETE ON question_versions
WHEN EXISTS (SELECT 1 FROM lesson_versions WHERE id=OLD.lesson_version_id AND status='published')
BEGIN
  SELECT RAISE(ABORT,'published question versions cannot be deleted');
END;

CREATE INDEX IF NOT EXISTS idx_lessons_current_published_version
  ON lessons(current_published_version_id);

CREATE TRIGGER IF NOT EXISTS trg_lessons_published_pointer_valid
BEFORE UPDATE OF current_published_version_id ON lessons
WHEN NEW.current_published_version_id IS NOT NULL
 AND NOT EXISTS (
   SELECT 1 FROM lesson_versions
   WHERE id=NEW.current_published_version_id
     AND lesson_id=NEW.id
     AND status='published'
 )
BEGIN
  SELECT RAISE(ABORT,'current published version must belong to lesson and be published');
END;

CREATE TRIGGER IF NOT EXISTS trg_assessment_policy_versions_no_update
BEFORE UPDATE ON assessment_policy_versions
BEGIN
  SELECT RAISE(ABORT,'assessment policy versions are immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_assessment_policy_versions_no_delete
BEFORE DELETE ON assessment_policy_versions
BEGIN
  SELECT RAISE(ABORT,'assessment policy versions cannot be deleted');
END;
