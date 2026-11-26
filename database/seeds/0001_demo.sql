-- Idempotent development seed for the versioned learning-content schema.
-- Create the legacy source rows first; published API reads use immutable version rows.

INSERT OR IGNORE INTO courses
  (id, slug, title, description, source_language, target_language, status)
VALUES
  ('course-english-foundations', 'english-foundations', 'English Foundations',
   'A starter course for practicing everyday English.', 'fa', 'en', 'published');

INSERT OR IGNORE INTO lessons
  (id, course_id, slug, title, description, level, position, version, status)
VALUES
  ('lesson-greetings-001', 'course-english-foundations', 'greetings',
   'Greetings and Introductions', 'Practice common greetings and polite introductions.', 'A1', 1, 1, 'published');

INSERT OR IGNORE INTO questions
  (id, lesson_id, type, prompt, options_json, answer_key, explanation, position)
VALUES
  ('question-greetings-001', 'lesson-greetings-001', 'multiple_choice',
   'Choose the correct greeting for the morning.',
   '[{"id":"a","text":"Good morning"},{"id":"b","text":"Good night"},{"id":"c","text":"Goodbye"}]',
   'a', 'Use “Good morning” when greeting someone in the morning.', 1),
  ('question-greetings-002', 'lesson-greetings-001', 'multiple_choice',
   'What is a suitable response to “How are you?”',
   '[{"id":"a","text":"I am fine, thank you."},{"id":"b","text":"See you yesterday."},{"id":"c","text":"Good night morning."}]',
   'a', '“I am fine, thank you” is a natural response.', 2);

INSERT OR IGNORE INTO lesson_versions
  (id, lesson_id, version, title, description, level, position, status, published_at)
VALUES
  ('lesson-greetings-001:v1', 'lesson-greetings-001', 1, 'Greetings and Introductions',
   'Practice common greetings and polite introductions.', 'A1', 1, 'draft', NULL);

INSERT OR IGNORE INTO question_versions
  (id, lesson_version_id, source_question_id, question_type, prompt, options_json, answer_key, explanation, weight, position)
SELECT q.id || ':v1', 'lesson-greetings-001:v1', q.id, q.type, q.prompt,
       q.options_json, q.answer_key, COALESCE(q.explanation, ''), 1, q.position
FROM questions q
JOIN lesson_versions lv ON lv.id = 'lesson-greetings-001:v1' AND lv.status = 'draft'
WHERE q.lesson_id = 'lesson-greetings-001'
  AND NOT EXISTS (
    SELECT 1 FROM question_versions existing
    WHERE existing.lesson_version_id = lv.id
      AND existing.source_question_id = q.id
  );

UPDATE lesson_versions
SET status = 'published', published_at = CURRENT_TIMESTAMP
WHERE id = 'lesson-greetings-001:v1'
  AND status = 'draft'
  AND (SELECT COUNT(*) FROM question_versions WHERE lesson_version_id = 'lesson-greetings-001:v1') = 2;

UPDATE lessons
SET current_published_version_id = 'lesson-greetings-001:v1'
WHERE id = 'lesson-greetings-001'
  AND EXISTS (
    SELECT 1 FROM lesson_versions
    WHERE id = 'lesson-greetings-001:v1'
      AND lesson_id = lessons.id
      AND status = 'published'
  );
