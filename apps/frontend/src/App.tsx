import { useEffect, useState } from "react";

type Lesson = { id: string; title: string; level: string; position: number };
type ApiState = "loading" | "ready" | "error";

export default function App() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [state, setState] = useState<ApiState>("loading");

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
          <p className="message">هنوز درسی منتشر نشده است. پس از اتصال پایگاه داده، محتوای نمونه نمایش داده می‌شود.</p>
        )}
        {state === "ready" && lessons.length > 0 && (
          <div className="lesson-grid">
            {lessons.map((lesson) => (
              <article className="lesson-card" key={lesson.id}>
                <span className="lesson-number">{String(lesson.position).padStart(2, "0")}</span>
                <div><span className="level">{lesson.level}</span><h3>{lesson.title}</h3><p>درس کوتاه · تمرین و مرور</p></div>
                <span className="arrow" aria-hidden="true">←</span>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer>ساخته‌شده برای یادگیری مرحله‌به‌مرحله <span>EnglishCodeApp · MVP</span></footer>
    </main>
  );
}
