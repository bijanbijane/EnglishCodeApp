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

## Migration history note
Migration 0002 خودش telegram_auth_replays و index انقضا را ایجاد می‌کند؛ migration 0003 همان اشیا را دوباره با IF NOT EXISTS تعریف می‌کند. تا زمانی که تاریخچهٔ اجرا در تمام محیط‌ها روشن نشده، هیچ‌یک را حذف یا بازنویسی نکنید.

## 0004 — Provider-neutral identity
جدول user_identities شناسهٔ داخلی user را از شناسهٔ ارائه‌دهنده جدا می‌کند. داده‌های Telegram موجود بدون تغییر users.id backfill می‌شوند. قید unique(provider, provider_subject) مانع اتصال یک هویت خارجی به دو حساب می‌شود.

## 0005 — Vocabulary and review
- vocabulary_items: محتوای واژگان منتشرشده در یک جفت زبان.
- user_vocabulary: وضعیت یادگیری و زمان مرور بعدی برای هر کاربر/واژه.
- vocabulary_review_events: رخدادهای مرور با idempotency key یکتا برای هر کاربر؛ UPDATE روی تاریخچه ممنوع است. حذف حساب از طریق cascade برای اجرای retention/deletion مجاز می‌ماند.
- revision در user_vocabulary برای جلوگیری از overwrite شدن دو مرور هم‌زمان.

## 0006 — Immutable learning content
- Existing lessons/questions are snapshotted as version 1.
- New attempts pin a lesson version and assessment policy version.
- Published lesson and question versions cannot be edited or deleted.
- The lesson publication pointer must reference a published version belonging to the same lesson.
- Assessment policy versions are immutable.
- Existing attempts are backfilled to version 1 and percentage-v1 policy.

## Execution policy
- ابتدا تمام migrationها را روی Local D1 خالی اجرا کنید.
- سپس مسیر ارتقا از schema قبلی را نیز تست کنید.
- بررسی کنید foreign_keys فعال‌اند و تمام unique/check/trigger/indexها اعمال شده‌اند.
- fixtureها فقط synthetic باشند.
- برای هر migration، شواهد اجرا، schema diff و recovery note ثبت شود.
- اجرای production فقط پس از backup/restore drill و تأیید مستقل مالک مجاز است.

Migrationهای 0004 تا 0006 در این شاخه فقط فایل SQL هستند؛ اجرای آن‌ها روی Cloudflare remote یا production انجام نشده است.
