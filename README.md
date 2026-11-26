# EnglishCodeApp

پلتفرم آموزش انگلیسی با شروع از Telegram Bot و Telegram Mini App؛ با مسیر توسعهٔ تدریجی به وب‌اپ و موبایل.

## وضعیت فعلی

این مخزن یک **vertical slice آموزشی بسیار محدود برای نمایش یک درس و بررسی پاسخ نمونه** دارد:
- Frontend: React + Vite + TypeScript، رابط فارسی و واکنش‌گرا.
- Backend: Hono با Worker-compatible entrypoint و adapter توسعهٔ محلی.
- API: health، فهرست درس‌ها، دریافت جزئیات درس و بررسی پاسخ در سمت سرور.
- Local preview: دادهٔ نمونهٔ موقت در adapter محلی؛ بدون نیاز به حساب Cloudflare.
- Database: migration اولیه و دادهٔ seed.
- Tests: تست‌های API و workflow اعتبارسنجی GitHub Actions.

محدودیت مهم: پاسخ‌ها هنوز به کاربر منتسب یا در پایگاه داده ذخیره نمی‌شوند؛ attempt، امتیاز نهایی، پیشرفت، احراز هویت تلگرام و session هنوز پیاده‌سازی نشده‌اند. endpoint بررسی پاسخ فعلاً یک نمونهٔ آموزشی و بدون احراز هویت است و production-ready نیست.

## اجرای محلی

نیازمندی: Node.js 22 یا جدیدتر.

```bash
npm install
npm run dev:backend
npm run dev:frontend
```

دو فرمان توسعه را در دو ترمینال جدا اجرا کنید. فرانت‌اند روی http://localhost:5173 و API روی http://localhost:8787 اجرا می‌شود. Vite درخواست‌های /api را به backend محلی proxy می‌کند. backend محلی سه درس نمونه و یک سؤال نمونه را از fixture حافظه‌ای برمی‌گرداند؛ این داده‌ها پایدار نیستند و فقط برای پیش‌نمایش هستند.

## بررسی‌ها

```bash
npm run typecheck
npm test
npm run build:frontend
```

نتیجهٔ این فرمان‌ها باید در محیط توسعه یا CI تأیید شود؛ وجود workflow به معنی سبز بودن تست‌ها نیست.

## API

- `GET /api/v1/health` — وضعیت اجرای API.
- `GET /api/v1/lessons` — فهرست درس‌های منتشرشده.
- `GET /api/v1/lessons/:lessonId` — جزئیات درس و گزینه‌های سؤال، بدون answer key.
- `POST /api/v1/lessons/:lessonId/check` — بررسی پاسخ توسط backend و بازگرداندن نتیجه و توضیح؛ فعلاً بدون ذخیرهٔ attempt یا احراز هویت.

در Worker، endpointهای درس به D1 نیاز دارند. adapter محلی فقط fixture نمایشی ارائه می‌کند.

## اتصال D1

Migration در `database/migrations/0001_initial.sql` و دادهٔ نمونه در `database/seeds/0001_demo.sql` است. اجرای migration روی هر حساب Cloudflare یا محیط production عمداً انجام نشده است. برای اجرای محلی D1 و استقرار Worker باید CLI و پیکربندی محیط پس از بررسی رسمی انتخاب و تنظیم شود.

## تصمیم‌های پابرجا

- Free-first؛ هیچ هزینه یا ارتقای پولی بدون تأیید صریح.
- منطق ارزیابی در backend؛ answer key در پاسخ GET به فرانت‌اند افشا نمی‌شود.
- Telegram initData باید سمت سرور اعتبارسنجی شود؛ هنوز پیاده‌سازی نشده.
- این شاخه برای بازبینی است؛ deployment یا تغییر production انجام نشده.
