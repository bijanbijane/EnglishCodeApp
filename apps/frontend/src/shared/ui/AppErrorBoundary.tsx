import { Component, type ReactNode } from "react";

type AppErrorBoundaryProps = { children: ReactNode };
type AppErrorBoundaryState = { hasError: boolean };

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-shell">
          <section className="state-panel state-panel--error app-fatal-error" role="alert" aria-live="assertive">
            <div>
              <strong>بخشی از برنامه با خطا روبه‌رو شد.</strong>
              <p>اطلاعات ثبت‌شده در سرور حفظ می‌شود. صفحه را دوباره بارگذاری کن؛ اگر مشکل ادامه داشت، بعداً دوباره تلاش کن.</p>
            </div>
            <button className="button button--secondary" type="button" onClick={() => window.location.reload()}>بارگذاری دوباره</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
