import { useEffect, useState } from "react";

type Lesson = { id: string; title: string; level: string; position: number };
type Question = { id: string; prompt: string; options: Array<{ id: string; text: string }> };
type LessonDetail = Lesson & { questions: Question[] };
type ApiState = "loading" | "ready" | "error";
type AnswerResult = { correct: boolean; explanation: string };

export default function App() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [state, setState] = useState<ApiState>("loading");
  const [activeLesson, setActiveLesson] = useState<LessonDetail | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [lessonError, setLessonError] = useState("");

  async function loadLessons() {
    setState("loading");
    try {
      const response = await fetch("/api/v1/lessons");
      if (!response.ok) throw new Error("API unavailable");
      const payload = await response.json() as { data: Lesson[] };
      setLessons(payload.data);
      setState("ready");
    } catch {
      setState("error");
    }
  }

  async function openLesson(lesson: Lesson) {
    setLessonError("");
    setSelectedAnswer("");
    setAnswerResult(null);
    try {
      const response = await fetch(`/api/v1/lessons/${encodeURIComponent(lesson.id)}`);
      if (!response.ok) throw new Error("Lesson unavailable");
      const payload = await response.json() as { data: LessonDetail };
      setActiveLesson(payload.data);
    } catch {
      setLessonError("دریافت محتوای درس ممکن نشد. دوباره تلاش کن.");
    }
  }

  async function checkAnswer() {
    if (!activeLesson?.questions[0] || !selectedAnswer) return;
    setChecking(true);
    setAnswerResult(null);
    try {
      const response = await fetch(`/api/v1/lessons/${encodeURIComponent(activeLesson.id)}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: activeLesson.questions[0].id, answerId: selectedAnswer })
      });
      if (!response.ok) throw new Error("Answer check failed");
      const payload = await response.json() as { data: AnswerResult };
      setAnswerResult(payload.data);
    } catch {
      setLessonError("بررسی پاسخ ممکن نشد. دوباره تلاش کن.");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => { void loadLessons(); }, []);

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="EnglishCodeApp home">
          <span className="brand-mark">E</span>
          <span>EnglishCode<span className="brand-light">App</span></span>
        </a>
        <span className="status">نسخهٔ آزمایشی</span>
      </header>

      <section className="hero">
        <p className="eyebrow">LEARN WITH A CLEAR PATH</p>
        <h1>انگلیسی را <span>پیوسته</span> یاد بگیر.</h1>
        <p className="intro">درس‌های کوتاه، تمرین هدفمند و پیشرفتی که می‌توانی اندازه بگیری.</p>
        <div className="hero-meta"><span className="meta-dot" /> مسیر یادگیری تو از یک درس شروع می‌شود</div>
      </section>

      <section className="lesson-section" aria-labelledby="lessons-title">
        <div className="section-heading">
          <div><p className="eyebrow">YOUR LEARNING SPACE</p><h2 id="lessons-title">درس‌های شروع</h2></div>
          <span className="count">{lessons.length} درس</span>
        </div>

        {state === "loading" && <p className="message">در حال دریافت درس‌ها…</p>}
        {state === "error" && (
          <div className="message error">
            <p>فعلاً ارتباط با سرویس درس‌ها برقرار نیست.</p>
            <button onClick={() => void loadLessons()}>تلاش دوباره</button>
          </div>
        )}
        {state === "ready" && lessons.length === 0 && (
          <p className="message">هنوز درسی منتشر نشده است.</p>
        )}
        {state === "ready" && lessons.length > 0 && (
          <div className="lesson-grid">
            {lessons.map((lesson) => (
              <button className="lesson-card" key={lesson.id} onClick={() => void openLesson(lesson)}>
                <span className="lesson-number">{String(lesson.position).padStart(2, "0")}</span>
                <span className="lesson-copy"><span className="level">{lesson.level}</span><strong>{lesson.title}</strong><small>برای شروع درس انتخاب کن</small></span>
                <span className="arrow" aria-hidden="true">←</span>
              </button>
            ))}
          </div>
        )}

        {lessonError && <p className="message error lesson-error">{lessonError}</p>}

        {activeLesson && (
          <section className="quiz-panel" aria-labelledby="quiz-title">
            <button className="back-button" onClick={() => { setActiveLesson(null); setAnswerResult(null); }}>بازگشت به درس‌ها</button>
            <p className="eyebrow">LESSON {activeLesson.position}</p>
            <h2 id="quiz-title">{activeLesson.title}</h2>
            {activeLesson.questions.length === 0 ? <p className="message">برای این درس هنوز تمرینی ثبت نشده است.</p> : (
              <>
                <p className="question-prompt">{activeLesson.questions[0].prompt}</p>
                <div className="answer-list">
                  {activeLesson.questions[0].options.map((option) => (
                    <button key={option.id} className={selectedAnswer === option.id ? "answer-option selected" : "answer-option"} disabled={Boolean(answerResult)} onClick={() => setSelectedAnswer(option.id)}>
                      <span>{option.id.toUpperCase()}</span>{option.text}
                    </button>
                  ))}
                </div>
                {!answerResult && <button className="submit-answer" disabled={!selectedAnswer || checking} onClick={() => void checkAnswer()}>{checking ? "در حال بررسی…" : "ثبت پاسخ"}</button>}
                {answerResult && (
                  <div className={answerResult.correct ? "answer-feedback correct" : "answer-feedback incorrect"}>
                    <strong>{answerResult.correct ? "پاسخ درست است." : "پاسخ درست نیست."}</strong>
                    <p>{answerResult.explanation}</p>
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </section>

      <footer>ساخته‌شده برای یادگیری مرحله‌به‌مرحله <span>EnglishCodeApp · MVP</span></footer>
    </main>
  );
}
