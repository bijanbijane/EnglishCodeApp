# EnglishCodeApp

پلتفرم آموزش انگلیسی با شروع از Telegram Bot و Telegram Mini App؛ با مسیر توسعهٔ تدریجی به وب‌اپ و موبایل.

## وضعیت فعلی

این شاخه شامل پایهٔ بک‌اند، ممیزی معماری فرانت‌اند و مشخصات اختصاصی Telegram Mini App است. فرانت‌اند فعلی هنوز فقط فهرست درس‌ها را نمایش می‌دهد؛ ورود تلگرام و جریان کامل درس/آزمون/پیشرفت پیاده‌سازی نشده‌اند.

## اسناد اصلی

- [Telegram Mini App architecture](docs/frontend/telegram-mini-app-architecture.md) — مرجع اصلی طراحی میزبان تلگرام، راه‌اندازی، نشست، دکمه‌ها و viewport.
- [Frontend architecture audit and roadmap](docs/frontend/architecture-and-roadmap.md)
- [ADR-0003 — Frontend architecture](docs/decisions/ADR-0003-frontend-architecture.md)
- [Backend API contract](docs/backend/API.md)
- [Backend README](apps/backend/README.md)
- [Frontend README](apps/frontend/README.md)

## اجرای محلی

نیازمندی: Node.js 22 یا جدیدتر.

```bash
npm install
npm run dev:backend
npm run dev:frontend
```

فرمان‌ها را در دو ترمینال جدا اجرا کنید. فرانت‌اند روی http://localhost:5173 و API روی http://localhost:8787 است. Vite فقط در توسعه درخواست‌های /api را proxy می‌کند. مسیر production هنوز تنظیم نشده است.

## بررسی‌ها

```bash
npm run typecheck
npm test
npm run build:frontend
```

نتیجهٔ این فرمان‌ها باید از CI یا اجرای واقعی تأیید شود؛ وجود فایل تست به‌تنهایی نشانهٔ موفقیت نیست.

## سیاست‌ها

- Free-first؛ هیچ هزینه یا ارتقای پولی بدون تأیید صریح.
- منطق دامنه، هویت، ارزیابی و پیشرفت در backend.
- کلید پاسخ سؤال به فرانت‌اند ارسال نمی‌شود.
- هیچ deployment یا migration عملیاتی در این شاخه انجام نمی‌شود.
