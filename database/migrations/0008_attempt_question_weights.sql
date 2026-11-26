ALTER TABLE attempt_questions
  ADD COLUMN question_weight REAL NOT NULL DEFAULT 1
  CHECK (question_weight > 0 AND question_weight <= 100);

UPDATE attempt_questions
SET question_weight = COALESCE((
  SELECT qv.weight
  FROM question_versions qv
  WHERE qv.id = attempt_questions.question_version_id
), 1);
