import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
const LearningContentModule = lazy(() => import("./features/learning-content/LearningContentModule"));
import { api, setAccessToken, type Course, type Lesson, type Profile } from "./api";
import { getSessionErrorMessage, restoreSession, revokeSession } from "./auth";
import { getTelegramWebApp } from "./platform/telegram";
import { useLearningProgress } from "./hooks/useLearningProgress";
import { useAttemptLifecycle } from "./hooks/useAttemptLifecycle";
import { useCourseCatalog } from "./hooks/useCourseCatalog";
import { useLearningHistory } from "./hooks/useLearningHistory";

type Screen = "home" | "lesson" | "result" | "content";
function App() {
  const telegram = getTelegramWebApp();

  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [screen, setScreen] = useState<Screen>("home");

  const [appBusy, setAppBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState<number | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const authStarted = useRef(false);
  const authInFlight = useRef(false);

  const handleProgressError = useCallback((e: unknown) => {
    setNotice(e instanceof Error ? e.message : "Could not load learning progress.");
  }, []);
  const { progress, progressLoading, refreshProgress } = useLearningProgress(profile, handleProgressError);
  const handleHistoryError = useCallback((e: unknown) => {
    setNotice(e instanceof Error ? e.message : "Could not load learning history.");
  }, []);
  const {
    history, historyLoading, historyLoadFailed, historyLoadingMore, hasMoreHistory, refreshHistory, loadMoreHistory,
  } = useLearningHistory({ profile, onError: handleHistoryError });
  const refreshLearnerData = useCallback(async () => {
    await Promise.all([refreshProgress(), refreshHistory()]);
  }, [refreshProgress, refreshHistory]);
  const handleCatalogError = useCallback((message: string) => setError(message), []);
  const {
    courses, lessons, coursesLoadFailed, lessonsLoadFailed, loading,
    loadCourses, openCourse, showCourses,
  } = useCourseCatalog({ onError: handleCatalogError });
  const handleAttemptError = useCallback((message: string) => setError(message), []);
  const handleAttemptNotice = useCallback((message: string) => setNotice(message), []);
  const handleAttemptCompleted = useCallback((resultScore: number) => {
    setScore(resultScore);
    setScreen("result");
  }, []);
  const {
    attempt, busy: attemptBusy, startAttempt, submitAnswer: runSubmitAnswer,
    completeAttempt: runCompleteAttempt, clearAttempt,
  } = useAttemptLifecycle({
    profile, refreshProgress: refreshLearnerData, onError: handleAttemptError,
    onNotice: handleAttemptNotice, onCompleted: handleAttemptCompleted,
  });
  const busy = appBusy || attemptBusy;

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

  const selectCourse = async (course: Course) => {
    setSelectedCourse(course); setSelectedLesson(null);
    await openCourse(course);
  };

  const returnToCourses = () => {
    showCourses();
    setSelectedCourse(null);
    setSelectedLesson(null);
  };

  const startLesson = async (lesson: Lesson) => {
    if (!profile) { setError("Open this app inside Telegram to sign in before starting a lesson."); return; }
    setError(""); setNotice("");
    if (await startAttempt(lesson)) {
      setSelectedLesson(lesson); setQuestionIndex(0); setAnswer(null); setScreen("lesson");
    }
  };

  const currentQuestion = attempt?.questions[questionIndex];
  const completed = useMemo(() => attempt?.questions.filter((q) => q.submittedAnswer !== null).length ?? 0, [attempt]);

  const submitAnswer = async () => {
    if (!currentQuestion || !answer) return;
    if (await runSubmitAnswer(currentQuestion, answer)) setAnswer(null);
  };

  const finishAttempt = () => { void runCompleteAttempt(); };

  const goHome = () => { setScreen("home"); setSelectedLesson(null); clearAttempt(); setNotice(""); setError(""); };

  const signIn = async () => {
    if (authInFlight.current) return;
    if (!telegram?.SecureStorage || !telegram.isVersionAtLeast?.("9.0")) {
      setError("Secure sign-in requires a recent Telegram app with Secure Storage support.");
      return;
    }
    authInFlight.current = true;
    setAuthLoading(true);
    setAppBusy(true); setError(""); setNotice("");
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
      setAppBusy(false);
    }
  };

  const logout = async () => {
    setAppBusy(true); setError("");
    try {
      if (!telegram?.SecureStorage) throw new Error("Secure session storage is unavailable.");
      const result = await revokeSession({
        storage: telegram.SecureStorage,
        logout: api.logout,
        setToken: setAccessToken,
      });
      setProfile(null); setSignedOut(true);
      setNotice(result.storageCleared
        ? "You have signed out. Close and reopen the Mini App to start a new Telegram sign-in session."
        : "You are signed out on the server, but Telegram could not clear the saved local token. Close and reopen the Mini App; the expired token will be replaced during sign-in.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not sign out."); }
    finally { setAppBusy(false); }
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
      {profile && <section className="history-section" aria-label="Recent learning history">
        <div className="history-heading">
          <div><p className="eyebrow">YOUR LEARNING RECORD</p><h2>Recent attempts</h2></div>
          <span className="progress-caption">{historyLoading ? "Loading…" : `${history.length} attempts`}</span>
        </div>
        {historyLoading && history.length === 0 ? <div className="history-empty">Loading recent attempts…</div>
          : historyLoadFailed && history.length === 0 ? <div className="history-empty">History could not be loaded. <button className="text-button" onClick={() => void refreshHistory()}>Retry</button></div>
          : history.length > 0 ? <div className="history-list">{history.map((item) =>
          <article className="history-row" key={item.attemptId}>
            <div className="history-main">
              <h3>{item.lessonTitle}</h3>
              <p>{item.courseTitle} · {new Date(item.completedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
            </div>
            <div className="history-result">
              <strong>{item.score === null ? "—" : `${item.score}%`}</strong>
              <small>{item.correctAnswerCount}/{item.questionCount} correct</small>
            </div>
          </article>
        )}</div> : <div className="history-empty">No completed lessons yet. Finish a lesson to see your results here.</div>}
        {hasMoreHistory && <button className="text-button history-more" onClick={() => void loadMoreHistory()} disabled={historyLoadingMore}>
          {historyLoadingMore ? "Loading more…" : "Load more attempts"}
        </button>}
      </section>}
      <section className="library-launch">
        <div><p className="eyebrow">EXPLORE & PRACTISE</p><h2>Build stronger English foundations.</h2><p>Search 2,138 vocabulary records or work through 40 common learner-error examples.</p></div>
        <button className="primary-button" onClick={() => setScreen("content")}>Open learning library ↗</button>
      </section>
      <section className="content-section">
      <div className="section-heading"><div><p className="eyebrow">YOUR LEARNING SPACE</p><h2>{selectedCourse ? selectedCourse.title : "Choose your path"}</h2></div>
        {selectedCourse && <button className="text-button" onClick={returnToCourses}>All courses ←</button>}
      </div>
      {loading ? <div className="loading"><span className="spinner" />Loading your learning space…</div> :
        selectedCourse ? <div className="lesson-list">{lessons.length ? lessons.map((lesson, index) =>
          <article className="lesson-card" key={lesson.id}>
            <div className="lesson-number">{String(index + 1).padStart(2, "0")}</div>
            <div className="lesson-info"><h3>{lesson.title}</h3><p>{lesson.description || "A focused practice session"}{lesson.level ? ` · ${lesson.level}` : ""}</p></div>
            <button className="round-button" disabled={busy} onClick={() => void startLesson(lesson)} aria-label={`Start ${lesson.title}`}>↗</button>
          </article>
        ) : lessonsLoadFailed ? <div className="empty-state"><span>Lessons could not be loaded.</span><button className="text-button" onClick={() => selectedCourse && void openCourse(selectedCourse)}>Retry loading lessons</button></div> : <div className="empty-state">No published lessons are available in this course yet.</div>}</div>
        : <div className="course-grid">{courses.length ? courses.map((course, index) =>
          <button className={`course-card course-${index % 3}`} key={course.id} onClick={() => void selectCourse(course)}>
            <span className="course-index">COURSE {String(index + 1).padStart(2, "0")}</span>
            <span className="course-title">{course.title}</span>
            <span className="course-description">{course.description || `Build your ${course.target_language} skills step by step.`}</span>
            <span className="course-link">Explore course <b>↗</b></span>
          </button>
        ) : coursesLoadFailed ? <div className="empty-state"><span>The course catalogue could not be loaded.</span><button className="text-button" onClick={() => void loadCourses()}>Retry loading courses</button></div> : <div className="empty-state">No published courses yet. Check back soon.</div>}</div>}
      </section>
    </>}

    {screen === "content" && <Suspense fallback={<div className="loading"><span className="spinner" />Loading learning library…</div>}>
      <LearningContentModule onBack={() => setScreen("home")} />
    </Suspense>}

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
