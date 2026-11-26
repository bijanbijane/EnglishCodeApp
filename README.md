# EnglishCodeApp

پلتفرم آموزش انگلیسی با شروع از Telegram Bot و Telegram Mini App؛ با مسیر توسعهٔ تدریجی به وب‌اپ و موبایل.

## وضعیت فعلی

این مخزن از مرحلهٔ مستندسازی به یک **vertical slice حداقلی قابل اجرا برای نمایش فهرست درس‌ها** رسیده است:
- Frontend: React + Vite + TypeScript، رابط فارسی و واکنش‌گرا.
- Backend: Hono با Worker-compatible entrypoint و adapter توسعهٔ محلی.
- API: health endpoint و فهرست درس‌های منتشرشده از D1.
- Local preview: دادهٔ نمونهٔ موقت در adapter محلی؛ بدون نیاز به حساب Cloudflare.
- Database: migration اولیه و دادهٔ seed.
- Tests: تست‌های پایهٔ API و workflow اعتبارسنجی GitHub Actions.

این نسخه هنوز احراز هویت واقعی تلگرام، ثبت attempt، ارزیابی پاسخ، پیشرفت کاربر، session یا پنل مدیریت ندارد. هیچ سرویس Cloudflare متصل نشده است.

## اجرای محلی

نیازمندی: Node.js 22 یا جدیدتر.

```bash
npm install
npm run dev:backend
npm run dev:frontend
```

دو فرمان توسعه را در دو ترمینال جدا اجرا کنید. فرانت‌اند روی http://localhost:5173 و API روی http://localhost:8787 اجرا می‌شود. Vite درخواست‌های /api را به backend محلی proxy می‌کند. backend محلی سه درس نمونه را از fixture حافظه‌ای برمی‌گرداند؛ این داده‌ها پایدار نیستند و فقط برای پیش‌نمایش UI هستند.

## بررسی‌ها

```bash
npm run typecheck
npm test
npm run build:frontend
```

نتیجهٔ این فرمان‌ها باید در محیط توسعه یا CI تأیید شود؛ وجود workflow به معنی سبز بودن تست‌ها نیست.

## API

- `GET /api/v1/health` — وضعیت اجرای API.
- `GET /api/v1/lessons` — فهرست درس‌های منتشرشده از D1؛ بدون binding دیتابیس در Worker پاسخ 503 می‌دهد. در adapter محلی فقط fixture نمایشی ارائه می‌شود.

## اتصال D1

Migration در `database/migrations/0001_initial.sql` و دادهٔ نمونه در `database/seeds/0001_demo.sql` است. اجرای migration روی هر حساب Cloudflare یا محیط production عمداً انجام نشده است. برای اجرای محلی D1 و استقرار Worker باید CLI و پیکربندی محیط پس از بررسی رسمی انتخاب و تنظیم شود.

## ساختار

- `apps/frontend`: رابط کاربری
- `apps/backend`: API و Worker entrypoint
- `database`: migration و seed
- `docs`: معماری، ADR و نقشهٔ راه

## تصمیم‌های پابرجا

- Free-first؛ هیچ هزینه یا ارتقای پولی بدون تأیید صریح.
- منطق دامنه و دادهٔ معتبر در backend.
- Telegram initData باید سمت سرور اعتبارسنجی شود؛ هنوز پیاده‌سازی نشده.
- این شاخه برای بازبینی است؛ deployment یا تغییر production انجام نشده.
