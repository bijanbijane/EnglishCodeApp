# EnglishCodeApp

پلتفرم آموزش انگلیسی با شروع از Telegram Bot و Telegram Mini App؛ با مسیر توسعهٔ تدریجی به وب‌اپ و موبایل.

## وضعیت فعلی

این شاخه شامل ممیزی معماری فرانت‌اند و نقشهٔ اجرای اصلاح‌شده در کنار پایهٔ بک‌اند است. فرانت‌اند فعلی فقط فهرست درس‌ها را نمایش می‌دهد؛ صفحهٔ سؤال، ارسال پاسخ، ورود تلگرام، پروفایل و پیشرفت هنوز در شاخهٔ فعلی پیاده‌سازی نشده‌اند.

- Frontend: React + Vite + TypeScript؛ پوستهٔ فارسی RTL و فهرست درس.
- Backend: Hono با Worker-compatible entrypoint و ساختار Modular Monolith.
- Auth: اعتبارسنجی Telegram Mini App initData و نشست داخلی در کد بک‌اند؛ کلاینت هنوز متصل نشده است.
- Learning: endpointهای درس، attempt، پاسخ و تکمیل در بک‌اند؛ رابط کاربری کامل هنوز متصل نشده است.
- Database: migrationهای SQL نسخه‌بندی‌شده؛ D1 محلی/Cloudflare هنوز اجرا نشده است.

## اسناد

- [نقشهٔ معماری و اجرای فرانت‌اند](docs/frontend/architecture-and-roadmap.md)
- [ADR-0003 — معماری فرانت‌اند](docs/decisions/ADR-0003-frontend-architecture.md)
- [قرارداد API بک‌اند](docs/backend/API.md)
- [نقشهٔ بک‌اند](apps/backend/README.md)

## اجرای محلی

نیازمندی: Node.js 22 یا جدیدتر.

```bash
npm install
npm run dev:backend
npm run dev:frontend
```

فرمان‌ها را در دو ترمینال جدا اجرا کنید. فرانت‌اند روی http://localhost:5173 و API روی http://localhost:8787 است. Vite فقط در توسعه درخواست‌های `/api` را proxy می‌کند؛ مسیر production هنوز تنظیم نشده است.

## بررسی‌ها

```bash
npm run typecheck
npm test
npm run build:frontend
```

نتیجهٔ این فرمان‌ها باید از محیط اجرا یا CI تأیید شود؛ وجود فایل تست یا workflow به‌تنهایی نشانهٔ موفقیت نیست.

## سیاست‌های غیرقابل‌تغییر

- Free-first؛ هیچ هزینه یا ارتقای پولی بدون تأیید صریح.
- منطق دامنه، هویت، ارزیابی و پیشرفت در backend.
- کلید پاسخ سؤال به فرانت‌اند ارسال نمی‌شود.
- هیچ deployment یا migration عملیاتی در این شاخه انجام نمی‌شود.
