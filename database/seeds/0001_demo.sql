INSERT OR IGNORE INTO courses (id, title, status)
VALUES ('course-english-foundations', 'English Foundations', 'published');

INSERT OR IGNORE INTO lessons (id, course_id, title, level, position, status) VALUES
('lesson-greetings', 'course-english-foundations', 'Greetings and introductions', 'A1', 1, 'published'),
('lesson-everyday-verbs', 'course-english-foundations', 'Everyday verbs', 'A1', 2, 'published'),
('lesson-simple-present', 'course-english-foundations', 'The simple present', 'A1', 3, 'published');

INSERT OR IGNORE INTO questions (id, lesson_id, prompt, options_json, answer_key, explanation, position) VALUES
('q-greetings-1', 'lesson-greetings', 'Choose the correct greeting for the morning.', '[{"id":"a","text":"Good morning"},{"id":"b","text":"Good night"},{"id":"c","text":"Goodbye"}]', 'a', 'Use “Good morning” when greeting someone in the morning.', 1);
