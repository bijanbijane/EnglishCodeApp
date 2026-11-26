# Backend — Cloudflare Worker

## مسئولیت

بک‌اند مرجع نهایی قواعد کسب‌وکار و داده‌های معتبر EnglishCodeApp است. پیاده‌سازی اولیه به‌صورت یک **Modular Monolith** روی Cloudflare Workers طراحی می‌شود. Hono گزینهٔ پایه برای routing است، اما سازگاری نسخهٔ انتخابی آن با runtime و bindings باید در نمونهٔ اجرایی آزموده شود.

## نقطهٔ ورود و handlerها

ساختار هدف یک Worker است که در نقطهٔ ورود خود handlerهای لازم را ارائه می‌دهد:

- HTTP: API و webhookهای موردنیاز
- Queue: مصرف jobهای پس‌زمینه، در صورت فعال بودن Queue

این جداسازی در کد و ماژول‌ها انجام می‌شود؛ در شروع برای هر قسمت Worker مستقل ایجاد نمی‌کنیم. جدا کردن deployableها تنها با شواهد بار، نیاز ایزولاسیون یا محدودیت عملیاتی توجیه می‌شود.

## ساختار هدف

~~~text
src/
├── index.ts
├── app.ts
├── routes/
│   ├── api/
│   └── webhooks/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── learning/
│   ├── content/
│   ├── assessment/
│   ├── progress/
│   ├── vocabulary/
│   ├── telegram/
│   ├── ai/
│   ├── media/
│   └── administration/
├── middleware/
├── platform/
│   ├── d1/
│   ├── r2/
│   ├── queues/
│   └── ai/
└── shared/
~~~

## الگوی هر ماژول دامنه

در صورت نیاز، هر ماژول می‌تواند این لایه‌ها را داشته باشد:

1. domain: قواعد و مدل‌های مستقل از Cloudflare
2. application: use caseها و orchestration
3. ports: قرارداد repositoryها و سرویس‌های بیرونی
4. infrastructure: پیاده‌سازی portها با D1، R2 یا API خارجی
5. http: handler و schemaهای ورودی/خروجی

برای ماژول کوچک، ایجاد همهٔ این پوشه‌ها اجباری نیست؛ از abstraction بدون نیاز واقعی جلوگیری می‌شود.

## قواعد

- route فقط درخواست را parse، validate و به use case هدایت می‌کند.
- منطق دامنه نباید به D1Database، R2Bucket یا ساختار پیام Queue وابسته باشد.
- دسترسی مستقیم به bindingها فقط از adapterهای زیر platform/ مجاز است.
- ورودی‌ها در مرز API اعتبارسنجی می‌شوند؛ مجوز دسترسی در سرور بررسی می‌شود.
- خطاها پاسخ ساختاریافته و بدون افشای secret یا اطلاعات داخلی دارند.
- webhookها و jobها باید در برابر تحویل تکراری idempotent باشند.
- عملیات مهم پیش از ارسال پیام Queue در D1 به‌شکل پایدار ثبت می‌شوند؛ Queue منبع حقیقت نیست.

## امنیت تلگرام

بک‌اند باید initData خام را طبق الگوریتم رسمی Telegram با HMAC-SHA-256 اعتبارسنجی کند و auth_date را از نظر تازگی بررسی کند. سپس هویت کاربر داخلی را ایجاد/بازیابی کند. token ربات فقط در Worker Secret نگهداری می‌شود. دادهٔ تأییدنشده نباید وارد session یا مجوز شود.

## وضعیت

این سند طرح مسئولیت‌ها و ساختار را مشخص می‌کند. Worker، routeها، bindings و تست‌های اجرایی هنوز ساخته یا deploy نشده‌اند.
