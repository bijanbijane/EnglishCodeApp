# EnglishCodeApp

پلتفرم آموزش انگلیسی با شروع از Telegram Bot و Telegram Mini App؛ با مسیر توسعهٔ تدریجی به وب‌اپ و موبایل.

## وضعیت فعلی این شاخه

شاخهٔ `feat/backend-domain-foundation` پایهٔ دامنه‌ای بک‌اند را روی vertical slice قبلی اضافه می‌کند:
- Frontend: React + Vite + TypeScript؛ رابط اولیهٔ واکنش‌گرا.
- Backend: Hono با Worker-compatible entrypoint و ساختار Modular Monolith.
- Auth: اعتبارسنجی Telegram Mini App initData، جلوگیری از replay و نشست Bearer داخلیِ قابل ابطال.
- Learning: خواندن درس/سؤال، شروع تلاش، ثبت پاسخ، نمره‌دهی سمت سرور و ذخیرهٔ پیشرفت.
- Database: migrationهای اولیه، نشست/پیشرفت و جلوگیری از استفادهٔ مجدد initData.
- Tests: تست API پایه و تست‌های امضای Telegram در مخزن؛ نتیجهٔ اجرا باید از CI تأیید شود.

این شاخه هنوز production-ready نیست. D1 واقعی، bot secret، rate limiting، سیاست نگهداری داده، تست end-to-end با D1 و استقرار عملیاتی تنظیم نشده‌اند.

## اجرای محلی

نیازمندی: Node.js 22 یا جدیدتر.

```bash
npm install
npm run dev:backend
npm run dev:frontend
```

فرمان‌ها را در دو ترمینال جدا اجرا کنید. فرانت‌اند روی http://localhost:5173 و API روی http://localhost:8787 است. adapter فعلی backend فقط برای پیش‌نمایش read-only درس‌هاست؛ نشست و نوشتن داده بدون D1 واقعی/محلی فعال نیست.

## بررسی‌ها

```bash
npm run typecheck
npm test
npm run build:frontend
```

## API

جزئیات قراردادها در [docs/backend/API.md](docs/backend/API.md) است.

## دیتابیس

Migrationها به ترتیب:
1. `database/migrations/0001_initial.sql`
2. `database/migrations/0002_backend_foundation.sql`
3. `database/migrations/0003_telegram_auth_replay.sql`

Seed فقط برای محیط local/test است: `database/seeds/0001_demo.sql`. این migrationها در حساب Cloudflare یا production اجرا نشده‌اند.

## سیاست‌های غیرقابل‌تغییر

- Free-first؛ هیچ هزینه یا ارتقای پولی بدون تأیید صریح.
- منطق دامنه، هویت، ارزیابی و پیشرفت در backend.
- کلید پاسخ سؤال به کلاینت ارسال نمی‌شود.
- هیچ deployment یا migration عملیاتی در این شاخه انجام نمی‌شود.