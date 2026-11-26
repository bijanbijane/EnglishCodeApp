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
  lesson_version_id: string;
};

export type QuestionRow = {
  id: string;
  type: string;
  prompt: string;
  options_json: string;
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
      `SELECT l.id, l.course_id, l.slug, lv.title, l.description, lv.level,
              lv.position, lv.version, lv.id AS lesson_version_id
       FROM lessons l
       JOIN lesson_versions lv ON lv.id = l.current_published_version_id
       WHERE l.course_id = ? AND l.status = 'published' AND lv.status = 'published'
       ORDER BY lv.position ASC`,
    ).bind(courseId).all<LessonRow>();
    return result.results;
  },

  getPublishedLesson(db: D1Database, lessonId: string): Promise<LessonRow | null> {
    return db.prepare(
      `SELECT l.id, l.course_id, l.slug, lv.title, l.description, lv.level,
              lv.position, lv.version, lv.id AS lesson_version_id
       FROM lessons l
       JOIN lesson_versions lv ON lv.id = l.current_published_version_id
       WHERE l.id = ? AND l.status = 'published' AND lv.status = 'published'
       LIMIT 1`,
    ).bind(lessonId).first<LessonRow>();
  },

  async listLessonQuestions(db: D1Database, lessonVersionId: string): Promise<QuestionRow[]> {
    const result = await db.prepare(
      `SELECT source_question_id AS id, question_type AS type, prompt, options_json, position
       FROM question_versions WHERE lesson_version_id = ? ORDER BY position ASC`,
    ).bind(lessonVersionId).all<QuestionRow>();
    return result.results;
  },
};
