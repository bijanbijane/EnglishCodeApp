PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS lesson_versions (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  title TEXT NOT NULL,
  description TEXT,
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
  source_question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
  question_type TEXT NOT NULL,
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
  config_json TEXT NOT NULL CHECK (json_valid(config_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(policy_key,version)
);

-- Preserve the current source content as its first explicit version.
INSERT OR IGNORE INTO lesson_versions
  (id,lesson_id,version,title,description,level,position,status,created_at,published_at)
SELECT l.id || ':v' || l.version,l.id,l.version,l.title,l.description,l.level,l.position,l.status,
       CURRENT_TIMESTAMP,CASE WHEN l.status='published' THEN CURRENT_TIMESTAMP ELSE NULL END
FROM lessons l;

-- Preserve older attempt versions as archived metadata; their exact question
-- content is restored from the immutable attempt_questions snapshot below.
INSERT OR IGNORE INTO lesson_versions
  (id,lesson_id,version,title,description,level,position,status,created_at,published_at)
SELECT DISTINCT a.lesson_id || ':v' || a.lesson_version,l.id,a.lesson_version,
       l.title,l.description,l.level,l.position,'archived',CURRENT_TIMESTAMP,NULL
FROM lesson_attempts a
JOIN lessons l ON l.id=a.lesson_id
WHERE a.lesson_version <> l.version;

INSERT OR IGNORE INTO question_versions
  (id,lesson_version_id,source_question_id,question_type,prompt,options_json,answer_key,explanation,weight,position)
SELECT q.id || ':v' || l.version,l.id || ':v' || l.version,q.id,q.type,q.prompt,
       q.options_json,q.answer_key,q.explanation,1,q.position
FROM questions q
JOIN lessons l ON l.id=q.lesson_id;

INSERT OR IGNORE INTO question_versions
  (id,lesson_version_id,source_question_id,question_type,prompt,options_json,answer_key,explanation,weight,position)
SELECT DISTINCT aq.question_id || ':v' || a.lesson_version,
       a.lesson_id || ':v' || a.lesson_version,aq.question_id,aq.question_type,
       aq.prompt,aq.options_json,aq.answer_key,'',1,aq.position
FROM attempt_questions aq
JOIN lesson_attempts a ON a.id=aq.attempt_id
JOIN lessons l ON l.id=a.lesson_id
WHERE a.lesson_version <> l.version;

INSERT OR IGNORE INTO assessment_policy_versions (id,policy_key,version,config_json)
VALUES (
  'percentage-v1',
  'percentage',
  1,
  '{"scoring":"weighted_percentage","unanswered":"incorrect","rounding":"nearest_integer","passThreshold":null,"retryPolicy":"unlimited"}'
);

ALTER TABLE lessons
  ADD COLUMN current_published_version_id TEXT REFERENCES lesson_versions(id);

UPDATE lessons
SET current_published_version_id = id || ':v' || version
WHERE status='published';

ALTER TABLE lesson_attempts
  ADD COLUMN lesson_version_id TEXT REFERENCES lesson_versions(id);
ALTER TABLE lesson_attempts
  ADD COLUMN assessment_policy_version_id TEXT REFERENCES assessment_policy_versions(id);

UPDATE lesson_attempts
SET lesson_version_id = lesson_id || ':v' || lesson_version,
    assessment_policy_version_id = 'percentage-v1'
WHERE lesson_version_id IS NULL OR assessment_policy_version_id IS NULL;

ALTER TABLE attempt_questions
  ADD COLUMN question_version_id TEXT REFERENCES question_versions(id);

UPDATE attempt_questions
SET question_version_id = question_id || ':v' || (
  SELECT a.lesson_version
  FROM lesson_attempts a
  WHERE a.id=attempt_questions.attempt_id
)
WHERE question_version_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_attempts_lesson_version_policy
  ON lesson_attempts(lesson_version_id,assessment_policy_version_id);
CREATE INDEX IF NOT EXISTS idx_lessons_current_published_version
  ON lessons(current_published_version_id);

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

CREATE TRIGGER IF NOT EXISTS trg_lesson_versions_insert_as_draft
BEFORE INSERT ON lesson_versions
WHEN NEW.status='published'
BEGIN
  SELECT RAISE(ABORT,'new lesson versions must be created as drafts');
END;

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
