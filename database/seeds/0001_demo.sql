INSERT OR IGNORE INTO courses
  (id, slug, title, description, source_language, target_language, status)
VALUES
  ('course-english-foundations', 'english-foundations', 'English Foundations',
   'A small sample course for local development.', 'fa', 'en', 'published');

INSERT OR IGNORE INTO lessons
  (id, course_id, slug, title, description, level, position, version, status)
VALUES
  ('lesson-greetings-001', 'course-english-foundations', 'greetings',
   'Greetings and Introductions', 'Practice common greetings.', 'A1', 1, 1, 'published');

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
