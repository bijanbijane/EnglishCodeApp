# Database Migrations

تمام تغییرات ساختار D1 باید از migrationهای SQL نسخه‌بندی‌شده و forward-only عبور کنند.

## قرارداد نام‌گذاری
نام فایل‌ها باید شمارهٔ ترتیبی و توضیح کوتاه داشته باشند:

    NNNN_short_description.sql

شماره و نام واقعی migrationهای هر نسخه را از فایل‌های موجود در همان commit بخوانید؛ فهرست نمونه، رزرو شماره یا تضمین وجود migration نیست. در شاخهٔ main در تاریخ ۲۷ نوامبر ۲۰۲۶، زنجیرهٔ موجود از 0001 تا 0015 است. Migrationهای موجود در PRهای باز تا زمان ادغام، بخشی از این زنجیره محسوب نمی‌شوند.

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

## اعتبارسنجی پیشنهادی
از پوشهٔ apps/backend:

    python3 ../../scripts/verify_backend_sqlite.py
    npm run db:migrate:local
    npm run db:seed:local
    npm run test:d1-local

SQLite verifier مکمل تست Wrangler Local D1 است و جایگزین آن نیست. از دادهٔ واقعی کاربر در تست مهاجرت استفاده نکنید.