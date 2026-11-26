export type CourseRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  source_language: string;
  target_language: string;
};

export type LessonRow = {
  id: string;
  course_id: string;
  slug: string;
  title: string;
  description: string | null;
  level: string | null;
  position: number;
  version: number;
};

export type QuestionRow = {
  id: string;
  type: string;
  prompt: string;
  options_json: string;
  explanation: string | null;
  position: number;
};

export const contentRepository = {
  async listPublishedCourses(db: D1Database): Promise<CourseRow[]> {
    const result = await db.prepare(
      `SELECT id, slug, title, description, source_language, target_language
       FROM courses WHERE status = 'published' ORDER BY title ASC`,
    ).all<CourseRow>();
    return result.results;
  },

  async listPublishedLessons(db: D1Database, courseId: string): Promise<LessonRow[]> {
    const result = await db.prepare(
      `SELECT id, course_id, slug, title, description, level, position, version
       FROM lessons
       WHERE course_id = ? AND status = 'published'
       ORDER BY position ASC`,
    ).bind(courseId).all<LessonRow>();
    return result.results;
  },

  getPublishedLesson(db: D1Database, lessonId: string): Promise<LessonRow | null> {
    return db.prepare(
      `SELECT id, course_id, slug, title, description, level, position, version
       FROM lessons WHERE id = ? AND status = 'published' LIMIT 1`,
    ).bind(lessonId).first<LessonRow>();
  },

  async listLessonQuestions(db: D1Database, lessonId: string): Promise<QuestionRow[]> {
    const result = await db.prepare(
      `SELECT id, type, prompt, options_json, explanation, position
       FROM questions WHERE lesson_id = ? ORDER BY position ASC`,
    ).bind(lessonId).all<QuestionRow>();
    return result.results;
  },
};
