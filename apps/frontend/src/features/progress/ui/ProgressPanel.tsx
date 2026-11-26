import { useEffect, useMemo, useState } from "react";
import { getMyProgress, type LessonProgress } from "../api/progress.api";
import type { ProgressState } from "../model/progress.types";

type ProgressPanelProps = { isAuthenticated: boolean; lessonTitles: Record<string, string>; onBack: () => void; onOpenLessons: () => void };

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(date);
}

function ProgressRow({ row, title }: { row: LessonProgress; title: string }) {
  return (
    <article className="progress-row">
      <div className="progress-row__main"><strong>{title}</strong><span>{formatDate(row.last_completed_at)}</span></div>
      <div className="progress-row__metrics"><span>بهترین امتیاز <b>{row.best_score}%</b></span><span>تکمیل <b>{row.completed_count} بار</b></span></div>
      <div className="progress-bar" role="progressbar" aria-label={"بهترین امتیاز درس " + title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0, Math.min(100, row.best_score))}><i style={{ width: Math.max(0, Math.min(100, row.best_score)) + "%" }} /></div>
    </article>
  );
}

export function ProgressPanel({ isAuthenticated, lessonTitles, onBack, onOpenLessons }: ProgressPanelProps) {
  const [state, setState] = useState<ProgressState>({ status: "loading" });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    setState({ status: "loading" });
    void getMyProgress().then((rows) => {
      if (active) setState({ status: "ready", rows });
    }).catch((error: unknown) => {
      if (active) setState({ status: "error", message: error instanceof Error ? error.message : "دریافت پیشرفت ناموفق بود." });
    });
    return () => { active = false; };
  }, [isAuthenticated, retry]);

  const totals = useMemo(() => {
    if (state.status !== "ready") return { lessons: 0, completions: 0, average: 0 };
    const completions = state.rows.reduce((sum, row) => sum + row.completed_count, 0);
    const average = state.rows.length ? Math.round(state.rows.reduce((sum, row) => sum + row.best_score, 0) / state.rows.length) : 0;
    return { lessons: state.rows.length, completions, average };
  }, [state]);

  return (
    <section className="progress-panel" aria-labelledby="progress-title">
      <button className="back-link" type="button" onClick={onBack}>→ بازگشت به خانه</button>
      <header className="progress-header"><p className="eyebrow">YOUR LEARNING RECORD</p><h1 id="progress-title">پیشرفت یادگیری</h1><p>این اطلاعات از سوابق ثبت‌شده در سرور دریافت می‌شود.</p></header>
      {!isAuthenticated ? (
        <div className="state-panel"><div><strong>برای مشاهدهٔ پیشرفت وارد حساب شو.</strong><p>سوابق یادگیری به حساب تلگرام متصل هستند.</p></div><button className="button button--secondary" type="button" onClick={onBack}>بازگشت</button></div>
      ) : state.status === "loading" ? (
        <div className="state-panel" role="status" aria-live="polite"><span className="loader" aria-hidden="true" /> در حال دریافت سوابق…</div>
      ) : state.status === "error" ? (
        <div className="state-panel state-panel--error" role="alert"><div><strong>دریافت سوابق ناموفق بود.</strong><p>{state.message}</p></div><button className="button button--secondary" type="button" onClick={() => setRetry((value) => value + 1)}>تلاش دوباره</button></div>
      ) : (
        <>
          <div className="progress-summary">
            <article><span>درس‌های تکمیل‌شده</span><strong>{totals.lessons}</strong></article>
            <article><span>مجموع دفعات تکمیل</span><strong>{totals.completions}</strong></article>
            <article><span>میانگین بهترین امتیازها</span><strong>{totals.average}%</strong></article>
          </div>
          {state.rows.length ? <div className="progress-list"><div className="progress-list__heading"><h2>سوابق درس‌ها</h2><span>{state.rows.length} مورد</span></div>{state.rows.map((row) => <ProgressRow key={row.lesson_id} row={row} title={lessonTitles[row.lesson_id] ?? "درس " + row.lesson_id} />)}</div> : <div className="state-panel"><div><strong>هنوز پیشرفتی ثبت نشده است.</strong><p>پس از تکمیل اولین درس، سوابق اینجا نمایش داده می‌شود.</p></div><button className="button button--secondary" type="button" onClick={onOpenLessons}>رفتن به درس‌ها</button></div>}
        </>
      )}
    </section>
  );
}
