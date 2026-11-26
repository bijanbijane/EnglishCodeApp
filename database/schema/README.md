# Database Schema

این پوشه محل تعریف مدل منطقی داده و تصمیم‌های schema است. ساختار اولیه به دامنه‌ها تقسیم می‌شود؛ نام نهایی جدول‌ها پس از طراحی ERD و آزمون queryها تثبیت خواهد شد.

## دامنه‌ها و موجودیت‌های پیشنهادی

| دامنه | موجودیت‌های اولیه |
|---|---|
| Identity | users، telegram_identities، sessions، user_settings |
| Learning Content | learning_paths، levels، courses، lessons، lesson_units، content_versions |
| Exercises | exercises، questions، answer_options، assessment_rules |
| Learner Activity | attempts، answers، completion_records |
| Progress | user_progress، progress_events، learning_streaks (در صورت نیاز واقعی) |
| Vocabulary | vocabulary_items، lesson_vocabulary، user_vocabulary_state |
| Operations | idempotency_keys، outbox_jobs، ai_usage_events، audit_events |

## الزامات طراحی

- کلیدهای اصلی و خارجی، unique constraints و قواعد حذف باید صریح باشند.
- وضعیت پاسخ کاربر باید با attempt و نسخهٔ سؤال/محتوا قابل ردیابی باشد.
- وضعیت پیشرفت باید از رویدادها و نتایج معتبر قابل بازسازی باشد؛ شمارندهٔ نمایشی به‌تنهایی منبع حقیقت نیست.
- eventها فقط با هدف روشن و حداقل داده ثبت شوند.
- اطلاعات حساس، tokenها و محتوای غیرضروری در telemetry یا logها ذخیره نشوند.
- schema نهایی پیش از migration اولیه باید با ERD، queryهای اصلی و سناریوهای حریم خصوصی بازبینی شود.

این فایل طرح اولیه است؛ هیچ‌یک از جدول‌های این فهرست هنوز در دیتابیس ساخته نشده‌اند.
