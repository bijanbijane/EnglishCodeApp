# Database Migrations

تمام تغییرات ساختار D1 باید از migrationهای SQL نسخه‌بندی‌شده و forward-only عبور کنند.

## قرارداد نام‌گذاری

```text
NNNN_short_description.sql
```

شماره و نام واقعی migrationها را از فایل‌های موجود در همان commit بخوانید. شماره‌ای را از روی مستندات قدیمی حدس نزنید یا رزرو فرض نکنید.

## زنجیرهٔ فعلی main

در commit مبنای این مستندات، `main` روی `533cab6821b39191338473e8fb13ce89c8013589` قرار دارد و migrationهای `0001` تا `0016` را شامل می‌شود. Migration شمارهٔ `0016_immutable_learning_events.sql` دفتر append-only رویدادهای تکمیل درس را اضافه می‌کند. شاخه‌ها و PRهای باز بخشی از این زنجیره نیستند تا زمانی که واقعاً ادغام شوند.

پیش از هر تغییر:
- فایل‌های migration و وضعیت واقعی branch هدف را دوباره بررسی کنید.
- migration اعمال‌شده روی دیتابیس مشترک را هرگز بازنویسی نکنید.
- شمارهٔ بعدی را فقط پس از بررسی آخرین فایل موجود انتخاب کنید.
- schema، foreign key، trigger، index، constraint و رفتار تراکنش را بررسی کنید.

## اعتبارسنجی

از پوشهٔ `apps/backend` و روی منابع Local جداشده استفاده کنید:

```bash
python3 ../../scripts/verify_backend_sqlite.py
npm run db:migrate:local
npm run db:seed:local
npm run test:d1-local
```

SQLite verifier مکمل Wrangler Local D1 است و جایگزین آن نیست. مسیر fresh install و upgrade از schema پشتیبانی‌شده باید هر دو آزموده شوند. فقط از دادهٔ مصنوعی استفاده کنید.

## Remote environments

اجرای migration روی هر دیتابیس remote عملیاتی مستقل است و به تأیید صریح مالک برای همان محیط، backup و برنامهٔ recovery نیاز دارد. Dry run به‌معنای اجرای migration نیست. Production بدون approval مستقل نباید تغییر کند.
