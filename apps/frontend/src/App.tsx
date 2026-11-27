import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, setAccessToken, type Attempt, type Course, type Lesson, type Profile } from "./api";
import { getSessionErrorMessage, restoreSession, revokeSession } from "./auth";

type TelegramSecureStorage = {
  getItem: (key: string, callback: (error: string | null, value: string | null, canRestore?: boolean) => void) => void;
  setItem: (key: string, value: string, callback: (error: string | null, stored?: boolean) => void) => void;
  removeItem: (key: string, callback: (error: string | null, removed?: boolean) => void) => void;
};
type TelegramWebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
  isVersionAtLeast?: (version: string) => boolean;
  SecureStorage?: TelegramSecureStorage;
  colorScheme?: "light" | "dark";
};
declare global { interface Window { Telegram?: { WebApp?: TelegramWebApp } } }

type Screen = "home" | "lesson" | "result";
type ProgressEntry = { lesson_id: string; course_id: string; best_score: number; completed_count: number; lesson_title: string; last_completed_at: string };
function App() {
  const telegram = window.Telegram?.WebApp;
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState<number | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const authStarted = useRef(false);
  const authInFlight = useRef(false);
  const courseRequestId = useRef(0);

  const loadCourses = useCallback(async () => {
    setLoading(true); setError("");
    try { setCourses(await api.courses()); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load courses."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    telegram?.ready();
    telegram?.expand();
    void loadCourses();
    if (!telegram || authStarted.current) return;
    authStarted.current = true;

    const secureStorage = telegram.SecureStorage;
    if (!telegram.isVersionAtLeast?.("9.0") || !secureStorage) {
      setNotice("Secure sign-in requires a recent Telegram app with Secure Storage support.");
      return;
    }

    // Prevent a manual sign-in click from racing this automatic restore/login.
    authInFlight.current = true;
    setAuthLoading(true);
    void restoreSession({
      storage: secureStorage,
      initData: telegram.initData,
      profile: api.profile,
      login: api.login,
      setToken: setAccessToken,
    }).then(setProfile).catch((e: unknown) => {
      setAccessToken(null);
      setNotice(getSessionErrorMessage(e));
    }).finally(() => {
      authInFlight.current = false;
      setAuthLoading(false);
    });
  }, [loadCourses]);

  const openCourse = async (course: Course) => {
    const requestId = ++courseRequestId.current;
    setSelectedCourse(course); setSelectedLesson(null); setLessons([]); setError("");
    setLoading(true);
    try {
      const nextLessons = await api.lessons(course.id);
      if (requestId === courseRequestId.current) setLessons(nextLessons);
    } catch (e) {
      if (requestId === courseRequestId.current) {
        setError(e instanceof Error ? e.message : "Could not load lessons.");
      }
    } finally {
      if (requestId === courseRequestId.current) setLoading(false);
    }
  };

  const showCourses = () => {
    // Invalidate any lesson request still in flight before returning to the course list.
    courseRequestId.current += 1;
    setSelectedCourse(null);
    setSelectedLesson(null);
    setLessons([]);
    setLoading(false);
    setError("");
  };

  const startLesson = async (lesson: Lesson) => {
    if (!profile) { setError("Open this app inside Telegram to sign in before starting a lesson."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const created = await api.startAttempt(lesson.id);
      const loaded = await api.attempt(created.attemptId);
      setSelectedLesson(lesson); setAttempt(loaded); setQuestionIndex(0); setAnswer(null); setScreen("lesson");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not start this lesson."); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!profile) { setProgress([]); return; }
    let active = true;
    setProgressLoading(true);
    api.progress().then((entries) => { if (active) setProgress(entries); })
      .catch((e: unknown) => { if (active) setNotice(e instanceof Error ? e.message : "Could not load learning progress."); })
      .finally(() => { if (active) setProgressLoading(false); });
    return () => { active = false; };
  }, [profile]);

  const currentQuestion = attempt?.questions[questionIndex];
  const completed = useMemo(() => attempt?.questions.filter((q) => q.submittedAnswer !== null).length ?? 0, [attempt]);

  const submitAnswer = async () => {
    if (!attempt || !currentQuestion || !answer) return;
    setBusy(true); setError("");
    try {
      const result = await api.answer(attempt.id, currentQuestion.id, answer);
      const refreshed = await api.attempt(attempt.id);
      setAttempt(refreshed);
      setNotice(result.isCorrect ? "Correct answer." : "Not quite. Keep going.");
      setAnswer(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not submit the answer."); }
    finally { setBusy(false); }
  };

  const finishAttempt = async () => {
    if (!attempt) return;
    setBusy(true); setError("");
    try {
      const result = await api.complete(attempt.id);
      setScore(result.score);
      setScreen("result");
      try {
        setProgress(await api.progress());
      } catch {
        setNotice("Lesson completed. Progress details will refresh when you return.");
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Could not complete the lesson."); }
    finally { setBusy(false); }
  };

  const goHome = () => { setScreen("home"); setSelectedLesson(null); setAttempt(null); setNotice(""); setError(""); };

  const signIn = async () => {
    if (authInFlight.current) return;
    if (!telegram?.SecureStorage || !telegram.isVersionAtLeast?.("9.0")) {
      setError("Secure sign-in requires a recent Telegram app with Secure Storage support.");
      return;
    }
    authInFlight.current = true;
    setAuthLoading(true);
    setBusy(true); setError(""); setNotice("");
    try {
      const restored = await restoreSession({
        storage: telegram.SecureStorage,
        initData: telegram.initData,
        profile: api.profile,
        login: api.login,
        setToken: setAccessToken,
      });
      setProfile(restored);
      setNotice("You are signed in.");
    } catch (e) {
      setAccessToken(null);
      setError(getSessionErrorMessage(e));
    } finally {
      authInFlight.current = false;
      setAuthLoading(false);
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true); setError("");
    try {
      if (!telegram?.SecureStorage) throw new Error("Secure session storage is unavailable.");
      const result = await revokeSession({
        storage: telegram.SecureStorage,
        logout: api.logout,
        setToken: setAccessToken,
      });
      setProfile(null); setProgress([]); setSignedOut(true);
      setNotice(result.storageCleared
        ? "You have signed out. Close and reopen the Mini App to start a new Telegram sign-in session."
        : "You are signed out on the server, but Telegram could not clear the saved local token. Close and reopen the Mini App; the expired token will be replaced during sign-in.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not sign out."); }
    finally { setBusy(false); }
  };

  return <main className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={goHome} aria-label="English Code home"><span className="brand-mark">EC</span><span>english<span className="brand-accent">code</span></span></button>
      <div className="account">{profile ? <><span className="status-dot" />{profile.display_name || "Learner"}<button className="text-button account-action" onClick={() => void logout()} disabled={busy}>Sign out</button></> : telegram ? signedOut ? <span className="muted">Reopen app to sign in</span> : <button className="text-button account-action" onClick={() => void signIn()} disabled={busy || authLoading}>{busy || authLoading ? "Connecting…" : "Sign in"}</button> : <span className="muted">Preview mode</span>}</div>
    </header>

    <section className="hero">
      <p className="eyebrow">A CLEARER WAY TO LEARN</p>
      <h1>Make English<br /><em>part of your day.</em></h1>
      <p className="hero-copy">Short, focused lessons. Measurable progress. A learning path built around consistency.</p>
      <div className="hero-meta"><span>01 — LEARN</span><span>02 — PRACTICE</span><span>03 — IMPROVE</span></div>
    </section>

    {error && <div className="alert" role="alert"><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}
    {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss message">×</button></div>}

    {screen === "home" && <>
      {profile && <section className="progress-section" aria-label="Learning progress">
        <div className="progress-heading"><div><p className="eyebrow">YOUR ACTIVITY</p><h2>Progress overview</h2></div><span className="progress-caption">{progressLoading ? "Updating…" : `${progress.length} unique ${progress.length === 1 ? "lesson" : "lessons"}`}</span></div>
        <div className="progress-stats">
          <article className="progress-stat"><span>LESSONS</span><strong>{progress.reduce((sum, item) => sum + item.completed_count, 0)}</strong><small>completed attempts</small></article>
          <article className="progress-stat"><span>BEST SCORES</span><strong>{progress.length ? Math.round(progress.reduce((sum, item) => sum + item.best_score, 0) / progress.length) : 0}<i>%</i></strong><small>average across lessons</small></article>
          <article className="progress-stat"><span>LESSON RECORDS</span><strong>{progress.length}</strong><small>unique lessons practiced</small></article>
        </div>
        {progress.length > 0 && <div className="recent-progress"><h3>Recently completed</h3>{progress.slice(0,3).map((item) => <div className="recent-row" key={item.lesson_id}><span>{item.lesson_title}</span><strong>{item.best_score}%</strong></div>)}</div>}
      </section>}
      <section className="content-section">
      <div className="section-heading"><div><p className="eyebrow">YOUR LEARNING SPACE</p><h2>{selectedCourse ? selectedCourse.title : "Choose your path"}</h2></div>
        {selectedCourse && <button className="text-button" onClick={showCourses}>All courses ←</button>}
      </div>
      {loading ? <div className="loading"><span className="spinner" />Loading your learning space…</div> :
        selectedCourse ? <div className="lesson-list">{lessons.length ? lessons.map((lesson, index) =>
          <article className="lesson-card" key={lesson.id}>
            <div className="lesson-number">{String(index + 1).padStart(2, "0")}</div>
            <div className="lesson-info"><h3>{lesson.title}</h3><p>{lesson.description || "A focused practice session"}{lesson.level ? ` · ${lesson.level}` : ""}</p></div>
            <button className="round-button" disabled={busy} onClick={() => void startLesson(lesson)} aria-label={`Start ${lesson.title}`}>↗</button>
          </article>
        ) : <div className="empty-state">{error ? "Lessons could not be loaded. Return to all courses and try again." : "No published lessons are available in this course yet."}</div>}</div>
        : <div className="course-grid">{courses.length ? courses.map((course, index) =>
          <button className={`course-card course-${index % 3}`} key={course.id} onClick={() => void openCourse(course)}>
            <span className="course-index">COURSE {String(index + 1).padStart(2, "0")}</span>
            <span className="course-title">{course.title}</span>
            <span className="course-description">{course.description || `Build your ${course.target_language} skills step by step.`}</span>
            <span className="course-link">Explore course <b>↗</b></span>
          </button>
        ) : <div className="empty-state">{error ? "The course catalogue could not be loaded." : "No published courses yet. Check back soon."}</div>}</div>}
      </section>
    </>}

    {screen === "lesson" && attempt && currentQuestion && <section className="exercise">
      <div className="exercise-top"><button className="text-button" onClick={goHome}>← Exit lesson</button><span>{selectedLesson?.title}</span></div>
      <div className="progress-track" role="progressbar" aria-label="Lesson progress" aria-valuemin={0} aria-valuemax={attempt.questions.length} aria-valuenow={completed}><span style={{ width: `${Math.min(100, completed / Math.max(1, attempt.questions.length) * 100)}%` }} /></div>
      <p className="eyebrow">QUESTION {String(questionIndex + 1).padStart(2, "0")} / {String(attempt.questions.length).padStart(2, "0")}</p>
      <h2>{currentQuestion.prompt}</h2>
      <div className="answer-list">{currentQuestion.options.map((option) =>
        <button key={option.id} className={`answer-option ${answer === option.id ? "selected" : ""} ${currentQuestion.submittedAnswer === option.id ? "submitted" : ""}`}
          aria-pressed={answer === option.id} disabled={currentQuestion.submittedAnswer !== null || busy} onClick={() => setAnswer(option.id)}>
          <span className="option-marker">{String.fromCharCode(65 + currentQuestion.options.indexOf(option))}</span>{option.text}
          {currentQuestion.submittedAnswer === option.id && <span className="answer-check">✓</span>}
        </button>)}</div>
      <div className="exercise-actions">
        {currentQuestion.submittedAnswer === null ? <button className="primary-button" disabled={!answer || busy} onClick={() => void submitAnswer()}>{busy ? "Checking…" : "Check answer"}</button>
          : questionIndex < attempt.questions.length - 1
            ? <button className="primary-button" onClick={() => { setQuestionIndex((i) => i + 1); setAnswer(null); setNotice(""); }}>Continue →</button>
            : <button className="primary-button" disabled={busy} onClick={() => void finishAttempt()}>{busy ? "Finishing…" : "Complete lesson"}</button>}
      </div>
    </section>}

    {screen === "result" && <section className="result-panel"><p className="eyebrow">LESSON COMPLETE</p><div className="result-score">{score ?? 0}<span>%</span></div><h2>Progress comes from practice.</h2><p>Your result has been saved to your learning record.</p><button className="primary-button" onClick={goHome}>Back to courses</button></section>}

    <footer className="footer"><span>ENGLISH CODE</span><span>Learn with intention.</span></footer>
  </main>;
}

export default App;
