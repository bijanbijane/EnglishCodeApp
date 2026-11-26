# Database Migrations

تمام تغییرات D1 باید از migrationهای SQL نسخه‌بندی‌شده عبور کنند. هیچ migration اعمال‌شده‌ای بازنویسی نمی‌شود.

| Version | File | Purpose |
|---|---|---|
| 0001 | 0001_initial.sql | users, courses, lessons, questions, attempts, answers |
| 0002 | 0002_backend_foundation.sql | sessions, replay table/index, answer uniqueness, progress |
| 0003 | 0003_telegram_auth_replay.sql | تکرار idempotent تعریف replay table/index از 0002؛ برای حفظ تاریخچه نگه داشته شده |
| 0004 | 0004_provider_neutral_identity.sql | نگاشت provider-neutral هویت و backfill شناسه‌های Telegram موجود |
| 0005 | 0005_vocabulary_review.sql | واژگان، وضعیت واژگان کاربر، رخدادهای مرور و کنترل revision |
| 0006 | 0006_versioned_learning_content.sql | snapshot نسخهٔ درس/سؤال، policy نمره‌دهی و اتصال Attempt به نسخهٔ ثابت |
| 0007 | 0007_admin_rbac_audit.sql | نقش‌های کاربری و audit log تغییرناپذیر |
| 0008 | 0008_immutable_results_progress_events.sql | نتیجهٔ تغییرناپذیر آزمون، رخداد پیشرفت append-only و بازسازی projection |
| 0009 | 0009_content_review_workflow.sql | مالک draft، درخواست review، رویدادهای review و کنترل گردش انتشار محتوا |

## Migration history note

Migration 0002 خودش telegram_auth_replays و index انقضا را ایجاد می‌کند؛ migration 0003 همان اشیا را دوباره با IF NOT EXISTS تعریف می‌کند. تا زمانی که تاریخچهٔ اجرا در تمام محیط‌ها روشن نشده، هیچ‌یک را حذف یا بازنویسی نکنید.

## 0004 — Provider-neutral identity
جدول user_identities شناسهٔ داخلی user را از شناسهٔ ارائه‌دهنده جدا می‌کند. داده‌های Telegram موجود بدون تغییر users.id backfill می‌شوند. قید unique(provider, provider_subject) مانع اتصال یک هویت خارجی به دو حساب می‌شود.

## 0005 — Vocabulary and review
- vocabulary_items: محتوای واژگان منتشرشده در یک جفت زبان.
- user_vocabulary: وضعیت یادگیری و زمان مرور بعدی برای هر کاربر/واژه.
- vocabulary_review_events: رخدادهای مرور با idempotency key یکتا برای هر کاربر؛ UPDATE روی تاریخچه ممنوع است.
- revision در user_vocabulary برای جلوگیری از overwrite شدن دو مرور هم‌زمان.

## 0006 — Immutable learning content
- Existing lessons/questions are snapshotted as version 1.
- New attempts pin a lesson version and assessment policy version.
- Published lesson and question versions cannot be edited or deleted.
- The lesson publication pointer must reference a published version belonging to the same lesson.
- Assessment policy versions are immutable.
- Existing attempts are backfilled to version 1 and percentage-v1 policy.

## 0007 — RBAC and audit foundation
- user_roles stores server-side role grants; roles are never read from client claims.
- admin_audit_events stores minimal metadata and append-only actor/action/resource/request facts.
- Ordinary updates/deletes are blocked. Account deletion may null the actor only; the audit event remains.
- No public role-grant endpoint exists. Protected content author/reviewer/admin routes use these grants; bootstrap/revocation is owner-controlled.

## 0008 — Immutable assessment results and progress facts
- attempt_results snapshots score, earned/total weight, correct/question counts, pinned lesson/policy versions and completion time.
- progress_events stores one immutable lesson_completed fact per attempt.
- Existing completed attempts are backfilled and user_progress is rebuilt from progress_events.
- Triggers block UPDATE/DELETE on result facts and progress events.
- New completion writes result, progress event and the read-optimized projection in one D1 batch.
- modules/progress/rebuild.ts can rebuild one user's projection atomically from immutable events.
- Physical account deletion requires a deliberate tombstone/pseudonymization and retention design; do not bypass RESTRICT/append-only controls casually.

## 0009 — Content author/review/publish workflow
- Adds `created_by_user_id` to lesson versions.
- `content_review_requests` stores one review lifecycle per immutable version; a rejected version is replaced by a new draft.
- `content_review_events` is append-only and records submit/approve/reject/publish transitions.
- Self-review is blocked both in the API and by a database trigger.
- Publishing is admin-only and updates the lesson pointer only after reviewer approval.
- Draft creation, reviewer decisions and publication include their admin audit insert in the same D1 batch.

## Execution policy
- ابتدا تمام migrationها را روی Local D1 خالی اجرا کنید.
- سپس مسیر ارتقا از schema قبلی را نیز تست کنید.
- بررسی کنید foreign_keys فعال‌اند و تمام unique/check/trigger/indexها اعمال شده‌اند.
- fixtureها فقط synthetic باشند.
- برای هر migration، شواهد اجرا، schema diff و recovery note ثبت شود.
- اجرای production فقط پس از backup/restore drill و تأیید مستقل مالک مجاز است.

Migrationهای 0004 تا 0009 روی Wrangler Local D1 اجرا و مسیر upgrade نیز با دادهٔ synthetic آزمایش شده است؛ هیچ‌یک روی Cloudflare remote یا production اجرا نشده‌اند.
