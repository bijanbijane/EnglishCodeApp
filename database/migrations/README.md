# Database Migrations

تمام تغییرات ساختار D1 باید از migrationهای SQL نسخه‌بندی‌شده و forward-only عبور کنند.

## قرارداد نام‌گذاری

نام فایل‌ها باید شمارهٔ ترتیبی و توضیح کوتاه داشته باشند:

    NNNN_short_description.sql

شماره و نام واقعی migrationهای هر نسخه را از فایل‌های موجود در همان commit بخوانید؛ مثال‌ها شماره رزرو یا تضمین وجود migration نیستند. زنجیرهٔ فعلی شاخهٔ `main` در commit بررسی‌شده از `0001` تا `0016` است. Migrationهای موجود در PRهای باز تا زمان ادغام، بخشی از این زنجیره محسوب نمی‌شوند.

## قواعد اجرا

- هر migration یک تغییر محدود، قابل بازبینی و سازگار با قراردادهای فعلی داشته باشد.
- migration اعمال‌شده در تاریخچهٔ مشترک بازنویسی نشود؛ اصلاح بعدی به migration جدید نیاز دارد.
- قبل از ادغام، migrationها روی دیتابیس Local تازه و با دادهٔ آزمایشی اجرا و بررسی شوند.
- مسیر upgrade از آخرین schema پشتیبانی‌شده نیز آزمایش شود؛ تست fresh install به‌تنهایی کافی نیست.
- foreign keyها، triggerها، indexها، constraintها و رفتار تراکنش بررسی شوند.
- برای تغییرات بزرگ، rollout سازگار با نسخهٔ قبلی برنامه طراحی شود.
- عملیات destructive نیازمند بررسی مسیر داده و برنامهٔ recovery است.
- اجرای migration روی هر محیط remote مرحله‌ای مستقل است و به backup/recovery plan و تأیید صریح مالک پروژه نیاز دارد.
- نسخهٔ migration اعمال‌شده باید قابل تشخیص و ممیزی باشد.

## Migration 0016 — immutable learning events

`0016_immutable_learning_events.sql` یک دفتر append-only برای رویدادهای تکمیل attempt درس اضافه می‌کند، رویدادهای تاریخی مربوط به attemptهای تکمیل‌شده را backfill می‌کند و کلید یکتای رویداد و indexهای خواندن بر اساس user/lesson را تعریف می‌کند. triggerها update و direct delete رویداد را مسدود می‌کنند؛ حذف parent user طبق سیاست FK به‌صورت cascade باقی می‌ماند. این ledger رویداد تکمیل درس است و نباید با ذخیره‌سازی نتیجهٔ ارزیابی تجمعی اشتباه گرفته شود.

## اعتبارسنجی پیشنهادی

از پوشهٔ `apps/backend` و فقط با دادهٔ مصنوعی:

    npm run typecheck
    npm test
    python3 ../../scripts/verify_backend_sqlite.py
    npm run db:migrate:local
    npm run db:seed:local
    npm run test:d1-local

SQLite verifier مکمل تست Wrangler Local D1 است و جایگزین آن نیست. نتیجهٔ هر اجرا را به commit دقیق همان اجرا نسبت دهید.

Remote migration عملیات جداگانه‌ای است و بدون تأیید صریح مالک، backup و برنامهٔ recovery اجرا نمی‌شود.
