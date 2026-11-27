# EnglishCodeApp

پلتفرم آموزش زبان انگلیسی با محوریت Telegram Bot و Telegram Mini App؛ با مسیر توسعهٔ تدریجی به وب‌اپلیکیشن و اپلیکیشن موبایل.

> **وضعیت مخزن (۲۷ نوامبر ۲۰۲۶):** main شامل Worker/Hono، API نسخه‌بندی‌شده، احراز هویت Telegram با اعتبارسنجی سمت سرور، session، مسیرهای attempt/answer و grading سمت سرور، progress، نقش‌های مدیریتی و گردش کار author/reviewer/publisher است. زنجیرهٔ migration موجود در main تا 0015 است. وضعیت پیاده‌سازی را با وضعیت اعتبارسنجی اشتباه نگیرید: GitHub Actions در اجراهای بررسی‌شده پیش از تخصیص runner متوقف شده (runner_id=0 و بدون step)، بنابراین این اجراها نه شکست تست‌های کد را ثابت می‌کنند و نه موفقیت آن‌ها را. شواهد Build مربوط به PRها فقط به commit و آزمون‌های مشخص‌شده در همان PR محدود است. PRهای باز، از جمله #17 تا #25، بخشی از main نیستند؛ وضعیت هر قابلیت باید بر اساس commit شاخهٔ main و نه صرفاً محتوای PR ارزیابی شود. هیچ Production deployment یا remote migration از این روند مجاز یا انجام نشده است.

## هدف محصول

ساخت یک پلتفرم جهانی و قابل توسعه برای آموزش انگلیسی که از تلگرام شروع می‌شود و در ادامه بتواند وب‌سایت و اپلیکیشن مستقل داشته باشد. دامنهٔ اولیه شامل مسیر یادگیری، درس و تمرین، واژگان، گرامر، ارزیابی، ثبت پاسخ و پایش پیشرفت است. قابلیت‌های هوش مصنوعی در فاز نخست محدود و کنترل‌شده خواهند بود.

## تصمیم‌های معماری فعلی

| حوزه | تصمیم پایه | وضعیت |
|---|---|---|
| پلتفرم آغازین | Telegram Bot + Telegram Mini App | مصوب در دامنهٔ محصول |
| مسیر توسعه | وب و موبایل در آینده، بدون وابستگی معماری به تلگرام | اصل طراحی |
| Runtime و میزبانی | Cloudflare Workers + Workers Static Assets | انتخاب معماری |
| زبان اصلی | TypeScript | انتخاب معماری |
| فرانت‌اند | React + Vite | انتخاب معماری؛ نیازمند نمونه‌سازی و آزمون |
| API | Hono روی Cloudflare Workers | انتخاب پیشنهادی؛ سازگاری باید در نمونهٔ اجرایی تأیید شود |
| دیتابیس عملیاتی | Cloudflare D1 (SQLite) | migration پایه و seed ثبت شده؛ اجرای Local D1 و ظرفیت هنوز آزموده نشده‌اند |
| لایهٔ دسترسی داده | SQL و Repository؛ Drizzle فقط پس از آزمون سازگاری مهاجرت‌ها | تصمیم مشروط |
| فایل و صوت | Cloudflare R2 | برای فایل‌ها؛ نه ذخیرهٔ باینری در D1 |
| پردازش پس‌زمینه | Cloudflare Queues | فقط برای کارهای واقعاً غیرهم‌زمان |
| هوش مصنوعی | Adapter مستقل؛ ارزیابی Workers AI پیش از اتصال | انتخاب مشروط |
| معماری نرم‌افزار | Modular Monolith | تصمیم پایه |
| سیاست هزینه | Free-first؛ هیچ ارتقای پولی بدون تأیید صریح مالک پروژه | مصوب |

این جدول **معماری هدف اولیه** را ثبت می‌کند، نه ادعای پیاده‌سازی یا آزمون موفق. نسخه‌ها، APIها، محدودیت‌ها و سازگاری ابزارها هنگام ساخت نمونهٔ اجرایی باید با مستندات جاری و آزمون واقعی بررسی شوند.

## ساختار مخزن

~~~text
EnglishCodeApp/
├── apps/
│   ├── frontend/                 # React + Vite؛ رابط Mini App
│   │   └── src/
│   │       ├── app/              # راه‌اندازی برنامه، router و providers
│   │       ├── pages/            # صفحات سطح برنامه
│   │       ├── features/         # قابلیت‌های یادگیری و حساب کاربر
│   │       ├── components/       # اجزای رابط کاربری
│   │       ├── services/         # ارتباط با API و Telegram WebApp
│   │       ├── hooks/
│   │       ├── styles/
│   │       └── assets/
│   └── backend/                  # یک Cloudflare Worker در قالب Modular Monolith
│       └── src/
│           ├── index.ts          # ورودی Worker و handlerهای fetch/queue
│           ├── app.ts            # ساخت برنامه و ثبت middleware/routes
│           ├── routes/           # مرزهای HTTP و نسخه‌بندی API
│           ├── modules/          # ماژول‌های مستقل دامنه
│           ├── middleware/       # احراز هویت، محدودسازی نرخ و خطا
│           ├── platform/         # اتصال به D1، R2، Queues و AI
│           └── shared/           # ابزارهای داخلی بک‌اند
├── database/
│   ├── schema/                   # طرح منطقی جداول و قراردادهای داده
│   ├── migrations/               # SQL migrationهای نسخه‌بندی‌شده
│   ├── seeds/                    # دادهٔ پایهٔ قابل تکرار
│   └── fixtures/                 # دادهٔ آزمایشی غیرواقعی
├── packages/
│   ├── contracts/                # قراردادهای API و DTOها
│   ├── validation/               # schemaهای اعتبارسنجی مشترک
│   ├── learning-core/            # منطق مستقل از پلتفرم یادگیری
│   ├── ai-adapters/              # رابط و adapter ارائه‌دهندگان AI
│   └── telegram-core/            # منطق قابل استفادهٔ مجدد تلگرام
├── docs/
│   ├── architecture/
│   ├── decisions/
│   ├── security/
│   └── operations/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   ├── security/
│   └── load/
├── .editorconfig
├── .gitignore
├── SECURITY.md
└── README.md
~~~

فایل‌های README داخل پوشه‌ها مرز و مسئولیت هر بخش را ثبت می‌کنند. در کنار آن‌ها، بخشی از کد اجرایی بک‌اند نیز اکنون روی `main` وجود دارد؛ وضعیت هر قابلیت در README همان بخش و اسناد backend مشخص شده است.

## جداسازی مسئولیت‌ها

### فرانت‌اند

- فقط رابط کاربری، state نمایشی، اعتبارسنجی اولیه و ارتباط با API را مدیریت می‌کند.
- مرجع نهایی مجوزها، امتیازها، پاسخ‌ها و پیشرفت یادگیری نیست.
- به D1، R2 یا secretهای Cloudflare دسترسی مستقیم ندارد.
- اطلاعات احراز هویت تلگرام را از Telegram.WebApp.initData می‌گیرد و برای اعتبارسنجی به بک‌اند می‌فرستد؛ initDataUnsafe قابل اعتماد نیست.

### بک‌اند

- مالک قوانین کسب‌وکار، احراز هویت، مجوزها، ارزیابی، ثبت پاسخ و محاسبهٔ پیشرفت است.
- در شروع یک Worker ماژولار دارد؛ مسیرهای HTTP، webhook تلگرام و مصرف پیام Queue در مرزهای جدا قرار می‌گیرند.
- ماژول‌ها از طریق قرارداد و interface با هم ارتباط می‌گیرند؛ دسترسی مستقیم و پراکنده به bindingها ممنوع است.
- جدا کردن API، webhook یا queue consumer به Worker مستقل فقط پس از اندازه‌گیری بار، نیاز امنیتی یا نیاز استقرار انجام می‌شود.

### دیتابیس

- D1 منبع اصلی داده‌های تراکنشی اولیه است.
- تعریف تغییرات ساختار دیتابیس فقط از طریق migrationهای SQL نسخه‌بندی‌شده انجام می‌شود.
- فایل صوتی، تصویر و محتوای حجیم در R2 نگهداری می‌شوند؛ D1 فقط metadata و کلید شیء را نگه می‌دارد.
- صف، cache و مدل هوش مصنوعی منبع حقیقت دادهٔ کاربر نیستند.

## نمای جریان اصلی

1. کاربر Mini App را در تلگرام باز می‌کند.
2. فرانت‌اند initData خام را به endpoint ورود می‌فرستد.
3. بک‌اند امضای Telegram و تازگی auth_date را بررسی می‌کند.
4. بک‌اند هویت داخلی و session را ایجاد یا بازیابی می‌کند.
5. درخواست یادگیری از API عبور می‌کند؛ مجوز، منطق دامنه و اعتبار داده در سرور بررسی می‌شوند.
6. دادهٔ تراکنشی در D1 ثبت می‌شود.
7. کار زمان‌بر، در صورت نیاز، با الگوی ثبت پایدار job و پیام Queue پردازش می‌شود.
8. فایل‌ها در R2 و metadata آن‌ها در D1 قرار می‌گیرند.

## سیاست هزینه: Free-first

- شروع فقط با امکانات و سهمیه‌های رایگان Cloudflare.
- هیچ پلن پولی، سرویس پولی، افزایش مصرف پولی یا ارتقای حساب بدون تأیید صریح مالک پروژه فعال نمی‌شود.
- با نزدیک شدن به سقف رایگان، قابلیت‌های غیرضروری محدود می‌شوند؛ هزینه به‌صورت خودکار ایجاد نمی‌شود.
- ثبت پاسخ و عملیات تأییدشده باید در برابر اختلال قابل بازیابی باشند.
- آستانه‌های پایش پیشنهادی مصرف: ۵۰٪، ۷۵٪ و ۹۰٪ از سهمیهٔ هر سرویس.
- مقدار سهمیه‌ها ثابت فرض نمی‌شود؛ پیش از هر فاز از مستندات رسمی و داشبورد حساب بررسی می‌شود.

جزئیات در [سیاست Free-first](docs/operations/free-tier-policy.md) و [تصمیم معماری](docs/decisions/ADR-0001-cloudflare-free-first.md) ثبت شده است.

## محدودیت مهم مقیاس‌پذیری

هدف بلندمدت جهانی، معماری را ملزم به جداسازی لایه‌ها و جلوگیری از وابستگی به یک ارائه‌دهندهٔ هویت یا کانال ورود می‌کند؛ اما این اسکلت، ظرفیت یک میلیون کاربر فعال روزانه را اثبات نمی‌کند. D1 در هر دیتابیس پردازش query تک‌ریسمانی دارد و پلن رایگان Workers/D1 سقف‌های مشخصی دارد. رشد واقعی باید با load test، سنجش query latency و طرح partitioning/read scaling بررسی شود.

## ترتیب اجرای باقی‌مانده

1. رفع مشکل تخصیص GitHub Actions runner و اجرای typecheck، تست‌ها و workflowها روی commit دقیق main.
2. اجرای migration و seed روی Local D1 تازه و ثبت شواهد؛ سپس تست upgrade و هم‌زمانی.
3. تکمیل آزمون‌های امنیتی cross-user، role revocation، idempotency و پاسخ/تکمیل هم‌زمان.
4. تکمیل owner-operated bootstrap و مستندات export/delete و backup/restore.
5. تکمیل تست‌های چرخهٔ author → reviewer → publisher و صفحه‌بندی تاریخچه/صف بازبینی.
6. ارزیابی R2، Queues و AI فقط پس از اثبات use case، بررسی حریم خصوصی و هزینهٔ جاری.
7. آزمون بازیابی، بار و سهمیه؛ سپس بررسی جداگانهٔ Development/Staging. Production نیازمند تأیید صریح و مستقل است.

قابلیت‌های موجود در PRهای باز را تا زمان ادغام و اعتبارسنجی روی commit نهایی، قابلیت main فرض نکنید.

## وضعیت قابلیت‌ها

- [x] سیاست Free-first و معماری Modular Monolith
- [x] Worker/Hono و endpointهای health/readiness
- [x] API نسخه‌بندی‌شده و خواندن محتوای منتشرشده بدون افشای answer key
- [x] Telegram authentication، session lifecycle و rate limiting در کد main
- [x] attempt، answer، grading سمت سرور و progress write در کد main
- [x] RBAC، author/reviewer workflow، انتشار کنترل‌شده و audit events
- [x] migrationهای SQL و seed مصنوعی؛ زنجیرهٔ main تا 0015
- [ ] اجرای موفق GitHub Actions روی commit دقیق main؛ runner allocation هنوز مسدود است
- [ ] ثبت نتیجهٔ fresh Local D1 و تست‌های concurrency روی commit دقیق main
- [ ] owner-operated bootstrap، export/delete و backup/restore کامل
- [ ] آزمون یکپارچگی، امنیت cross-user، بار و آمادگی انتشار عملیاتی

## اسناد

- [نمای معماری](docs/architecture/overview.md)
- [ADR-0001: Cloudflare-native و Free-first](docs/decisions/ADR-0001-cloudflare-free-first.md)
- [سیاست سهمیه و هزینه](docs/operations/free-tier-policy.md)
- [گزارش امنیت](SECURITY.md)
- [Backend architecture](docs/backend/ARCHITECTURE.md)
- [Backend API contract](docs/backend/API.md)
- [Backend data model](docs/backend/DATA-MODEL.md)
- [Backend security baseline](docs/backend/SECURITY.md)
- [Backend operations](docs/backend/OPERATIONS.md)
