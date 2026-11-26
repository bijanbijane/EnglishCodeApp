import { useEffect, useState } from "react";
import { getMyProfile, type LearnerProfile } from "../api/user.api";

type ProfilePanelProps = {
  isAuthenticated: boolean;
  isTelegramHost: boolean;
  signingOut: boolean;
  error?: string;
  onSignOut: () => void;
  onBack: () => void;
};

export function ProfilePanel({ isAuthenticated, isTelegramHost, signingOut, error, onSignOut, onBack }: ProfilePanelProps) {
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setProfileError(null);
    if (!isAuthenticated) { setProfile(null); return () => { active = false; }; }
    void getMyProfile().then((value) => { if (active) setProfile(value); }).catch((reason: unknown) => {
      if (active) setProfileError(reason instanceof Error ? reason.message : "دریافت اطلاعات حساب ناموفق بود.");
    });
    return () => { active = false; };
  }, [isAuthenticated]);

  return (
    <section className="profile-panel" aria-labelledby="profile-title">
      <button className="back-link" type="button" onClick={onBack}>→ بازگشت به خانه</button>
      <header className="profile-header">
        <p className="eyebrow">ACCOUNT & SESSION</p>
        <h1 id="profile-title">حساب کاربری</h1>
        <p>وضعیت اتصال و امنیت نشست فعلی برنامه.</p>
      </header>
      {isAuthenticated && <article className="profile-identity"><span className="profile-identity__avatar" aria-hidden="true">{(profile?.displayName || "E").slice(0,1)}</span><div><strong>{profile?.displayName || "کاربر EnglishCode"}</strong><span>{profile ? "حساب متصل به تلگرام" : "در حال دریافت اطلاعات حساب…"}</span></div></article>}
      <article className="profile-session-card">
        <div className="profile-session-card__icon" aria-hidden="true">{isAuthenticated ? "✓" : "○"}</div>
        <div className="profile-session-card__content">
          <strong>{isAuthenticated ? "حساب تلگرام متصل است" : "حالت پیش‌نمایش عمومی"}</strong>
          <p>{isAuthenticated
            ? "نشست ورود در SecureStorage تلگرام نگه‌داری می‌شود و درخواست‌های آموزشی با توکن معتبر به سرور ارسال می‌شوند."
            : isTelegramHost
              ? "برای فعال شدن تمرین‌ها، Mini App را از مسیر اصلی یا منوی ربات باز کن و مطمئن شو تلگرام از SecureStorage پشتیبانی می‌کند."
              : "در مرورگر مستقل، فهرست و محتوای عمومی درس‌ها قابل مشاهده است. ورود و ثبت پیشرفت تا زمان پشتیبانی نشست امن سمت سرور غیرفعال است."}</p>
        </div>
      </article>
      {(error || profileError) && <p className="inline-error" role="alert">{error || profileError}</p>}
      {isAuthenticated && <div className="profile-actions"><button className="button button--secondary" type="button" disabled={signingOut} onClick={onSignOut}>{signingOut ? "در حال خروج…" : "خروج از حساب"}</button></div>}
      <aside className="profile-privacy"><strong>نحوهٔ نگه‌داری نشست</strong><p>توکن ورود در localStorage یا sessionStorage مرورگر ذخیره نمی‌شود. در Mini App، در صورت پشتیبانی نسخهٔ تلگرام، توکن فقط در SecureStorage نگه‌داری می‌شود.</p></aside>
    </section>
  );
}
