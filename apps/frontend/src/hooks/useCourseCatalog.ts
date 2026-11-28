import { useCallback, useRef, useState } from "react";
import { api, type Course, type Lesson } from "../api";

type Options = { onError: (message: string) => void };

export function useCourseCatalog({ onError }: Options) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [coursesLoadFailed, setCoursesLoadFailed] = useState(false);
  const [lessonsLoadFailed, setLessonsLoadFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const courseRequestId = useRef(0);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setCoursesLoadFailed(false);
    onError("");
    try {
      setCourses(await api.courses());
    } catch (error) {
      setCoursesLoadFailed(true);
      onError(error instanceof Error ? error.message : "Could not load courses.");
    } finally {
      setLoading(false);
    }
  }, [onError]);

  const openCourse = useCallback(async (course: Course) => {
    const requestId = ++courseRequestId.current;
    setLessons([]);
    setLessonsLoadFailed(false);
    onError("");
    setLoading(true);
    try {
      const nextLessons = await api.lessons(course.id);
      if (requestId === courseRequestId.current) setLessons(nextLessons);
    } catch (error) {
      if (requestId === courseRequestId.current) {
        setLessonsLoadFailed(true);
        onError(error instanceof Error ? error.message : "Could not load lessons.");
      }
    } finally {
      if (requestId === courseRequestId.current) setLoading(false);
    }
  }, [onError]);

  const showCourses = useCallback(() => {
    courseRequestId.current += 1;
    setLessons([]);
    setLessonsLoadFailed(false);
    setLoading(false);
    onError("");
  }, [onError]);

  return {
    courses, lessons, coursesLoadFailed, lessonsLoadFailed, loading,
    loadCourses, openCourse, showCourses,
  };
}
