# Database Migrations

تمام تغییرات D1 باید از migrationهای SQL نسخه‌بندی‌شده عبور کنند.

## قرارداد نام‌گذاری

~~~text
0001_initial_identity.sql
0002_learning_content.sql
0003_assessment_attempts.sql
0004_progress_and_vocabulary.sql
0005_async_jobs_and_audit.sql
~~~

نام‌ها نمونه‌اند و تا زمان ایجاد migration واقعی رزرو محسوب نمی‌شوند.

## قواعد اجرا

- هر migration یک تغییر محدود و قابل بازبینی داشته باشد.
- migration اعمال‌شده در تاریخچه بازنویسی نشود؛ اصلاح بعدی migration جدید می‌خواهد.
- قبل از اجرا، روی دیتابیس محلی و دادهٔ آزمایشی اجرا و بررسی شود.
- برای تغییرات بزرگ، rollout سازگار با نسخهٔ قبلی برنامه طراحی شود.
- عملیات destructive مثل حذف یا تغییر نوع ستون، نیازمند بررسی مسیر داده و rollback/recovery است.
- اجرای migration روی محیط عملیاتی باید مرحلهٔ مستقل با backup/recovery plan و تأیید مالک پروژه باشد.
- نسخهٔ migration اعمال‌شده باید قابل تشخیص و ممیزی باشد.
