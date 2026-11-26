# EnglishCodeApp

پلتفرم آموزش انگلیسی با شروع از Telegram Bot و Telegram Mini App؛ با مسیر توسعهٔ تدریجی به وب‌اپ و موبایل.

## وضعیت فعلی شاخه

- Frontend: React 19 + Vite + TypeScript.
- Backend: Hono + TypeScript روی Cloudflare Workers؛ معماری Modular Monolith.
- Database: Cloudflare D1 با migrationهای نسخه‌بندی‌شده.
- Auth: Telegram Mini App HMAC، کنترل freshness و replay، نشست bearer opaque و نگاشت هویت مستقل از provider.
- Learning: محتوای version-pinned، attempt، ثبت پاسخ، ارزیابی سمت سرور، نتیجه و progress.
- Vocabulary: ثبت واژگان و مرور فاصله‌دار نسخه‌دار با idempotency و revision.
- CI: lockfile ریشه و `npm ci`؛ typecheck، تست بک‌اند و build فرانت‌اند.

این شاخه هنوز production-ready نیست. پنل مدیریت/نویسندگی محتوا، چهار مهارت کامل، RBAC مدیریتی، محدودیت نرخ توزیع‌شده، media/R2، Queue/outbox، حذف/خروجی حساب و سیاست‌های نهایی retention هنوز تکمیل نشده‌اند.

## اجرای محلی

نیازمندی: Node.js 22 یا جدیدتر.

```bash
npm ci
npm run typecheck
npm test
npm run build:frontend
```

## اجرای Worker و D1 محلی

فایل `wrangler.toml` فقط برای توسعهٔ local ساخته شده و شناسهٔ D1 آن placeholder است. هیچ database id یا secret عملیاتی در آن نیست.

```bash
npm run db:migrate:local
npm run db:migrations:local
```

برای اجرای Worker محلی، ابتدا فایل محلی و ignored با نام `.dev.vars` بسازید و مقدار آزمایشی `TELEGRAM_BOT_TOKEN` را قرار دهید؛ توکن واقعی را داخل Git یا پیام‌ها قرار ندهید.

```bash
npm run dev:worker
```

Local D1 state در `.wrangler/` ذخیره می‌شود و در Git ثبت نمی‌شود. هرگز `--remote` را برای اجرای این آزمون‌ها اضافه نکنید.

## Migrationها

به ترتیب:
1. `0001_initial.sql`
2. `0002_backend_foundation.sql`
3. `0003_telegram_auth_replay.sql`
4. `0004_provider_neutral_identity.sql`
5. `0005_vocabulary_review.sql`
6. `0006_versioned_learning_content.sql`

Migration 0003 تکرار idempotent تعریف replay table/index موجود در 0002 است؛ تاریخچه حفظ شده و نباید migration اعمال‌شده بازنویسی شود.

## شواهد اعتبارسنجی محلی

در ۲۶ نوامبر ۲۰۲۶:
- `npm ci` موفق.
- TypeScript typecheck موفق برای frontend و backend.
- ۳۲ تست بک‌اند موفق.
- frontend production build موفق.
- هر ۶ migration روی Local D1 خالی اجرا شد.
- مسیر upgrade از schema شمارهٔ 0001 با دادهٔ قدیمی synthetic تا 0006 اجرا شد؛ identity، lesson version و attempt policy backfill تأیید شد.
- ورود هم‌زمان با initData یکسان روی Worker + Local D1: یک پاسخ 200 و یک پاسخ 409.
- رقابت پاسخ/تکمیل، جلوگیری از پاسخ پس از تکمیل، تکرار completion و شمارش progress روی Local D1 بررسی شد.
- idempotency مرور واژگان و رد استفادهٔ مجدد از کلید با payload متفاوت روی Local D1 بررسی شد.

جزئیات و محدودیت شواهد: [LOCAL-VERIFICATION.md](docs/backend/LOCAL-VERIFICATION.md).

## سیاست‌های غیرقابل‌تغییر

- Free-first؛ هیچ هزینه یا ارتقای پولی بدون تأیید صریح.
- منطق دامنه، هویت، ارزیابی و پیشرفت در backend.
- کلید پاسخ سؤال به کلاینت ارسال نمی‌شود.
- هیچ migration راه دور، deployment یا تغییر production بدون تأیید مستقل انجام نمی‌شود.
- PRهای معماری تا تکمیل gateهای مربوط Draft می‌مانند.
