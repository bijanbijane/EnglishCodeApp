# Database Migrations

تمام تغییرات D1 باید از migrationهای SQL نسخه‌بندی‌شده عبور کنند. هیچ migration اعمال‌شده‌ای بازنویسی نمی‌شود.

| Version | File | Purpose |
|---|---|---|
| 0001 | 0001_initial.sql | users, courses, lessons, questions, attempts, answers |
| 0002 | 0002_backend_foundation.sql | sessions, replay table/index, answer uniqueness, progress |
| 0003 | 0003_telegram_auth_replay.sql | تکرار idempotent تعریف replay table/index از 0002؛ برای حفظ تاریخچه نگه داشته شده |
| 0004 | 0004_provider_neutral_identity.sql | نگاشت provider-neutral هویت و backfill شناسه‌های Telegram موجود |
| 0005 | 0005_vocabulary_review.sql | واژگان، وضعیت واژگان کاربر، رخدادهای مرور و کنترل revision |

## Migration history note

Migration 0002 خودش telegram_auth_replays و index انقضا را ایجاد می‌کند؛ migration 0003 همان اشیا را دوباره با IF NOT EXISTS تعریف می‌کند. این تکرار در SQLite/D1 ساخت دوباره ایجاد نمی‌کند، اما تاریخچه را غیرضروری و مبهم می‌کند. تا زمانی که تاریخچهٔ اجرا در تمام محیط‌ها روشن نشده، هیچ‌یک را حذف یا بازنویسی نکنید.

## 0004 — Provider-neutral identity

جدول user_identities شناسهٔ داخلی user را از شناسهٔ ارائه‌دهنده جدا می‌کند. داده‌های Telegram موجود بدون تغییر users.id به این جدول backfill می‌شوند. قید unique(provider, provider_subject) مانع اتصال یک هویت خارجی به دو حساب می‌شود؛ unique(user_id, provider) فعلاً حداکثر یک هویت از هر provider را برای هر کاربر مجاز می‌کند.

## 0005 — Vocabulary and review

- vocabulary_items: محتوای واژگان منتشرشده در یک جفت زبان.
- user_vocabulary: وضعیت یادگیری و زمان مرور بعدی برای هر کاربر/واژه.
- vocabulary_review_events: تاریخچهٔ append-only مرور با idempotency key یکتا برای هر کاربر.
- revision در user_vocabulary برای جلوگیری از overwrite شدن دو مرور هم‌زمان اضافه شده است.

## Execution policy

- ابتدا تمام migrationها را روی Local D1 خالی اجرا کنید.
- سپس مسیر ارتقا از schema قبلی را نیز تست کنید.
- بررسی کنید foreign_keys فعال‌اند و تمام unique/check/indexها اعمال شده‌اند.
- fixtureها فقط synthetic باشند.
- برای هر migration، شواهد اجرا، schema diff و recovery note ثبت شود.
- اجرای production فقط پس از backup/restore drill و تأیید مستقل مالک مجاز است.

هیچ migration در این شاخه روی Cloudflare remote یا production اجرا نشده است.
