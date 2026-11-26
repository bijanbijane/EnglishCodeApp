# نمای معماری EnglishCodeApp

**تاریخ ثبت:** ۲۶ نوامبر ۲۰۲۶  
**وضعیت:** طرح معماری اولیه؛ هنوز با پیاده‌سازی یا load test اثبات نشده است.

## 1. اصول طراحی

1. ابتدا Telegram Bot و Mini App؛ اما مدل هویت و دامنه به Telegram وابسته نشود.
2. فرانت‌اند، بک‌اند و دیتابیس سه مرز مستقل با قراردادهای مشخص دارند.
3. شروع با Modular Monolith؛ نه microservices و نه چند Worker بی‌دلیل.
4. Cloudflare-native تا حدی که برای نیاز واقعی محصول مناسب باشد.
5. Free-first و عدم ایجاد هزینه بدون تأیید صریح مالک.
6. انتقال فایل و پردازش طولانی از درخواست تعاملی به مسیرهای مجزا.
7. وضعیت‌های مهم یادگیری در دیتابیس پایدار ثبت شوند.

## 2. نمای منطقی سیستم

~~~text
Telegram Client
   ├── Telegram Bot
   └── Telegram Mini App
            |
            v
      Frontend (React + Vite)
            |
            | HTTPS / JSON
            v
   Cloudflare Workers (Backend)
      ├── API routes
      ├── Telegram webhook
      ├── Domain modules
      └── Queue handler (when enabled)
            |
      ┌─────┼──────────┐
      v     v          v
     D1    R2        Queues
  records  files     async delivery
      |
      v
  Outbox / job state

AI access:
Backend -> AI adapter -> evaluated provider (Workers AI only if quality/cost pass)
~~~

## 3. مرز فرانت‌اند

React + Vite + TypeScript برای Mini App انتخاب پایه است. فرانت‌اند فقط UI و تعامل را انجام می‌دهد. تمام تصمیم‌های امنیتی، اعتبارسنجی نهایی پاسخ، محاسبهٔ امتیاز و ثبت پیشرفت در سرور انجام می‌شوند.

Workers Static Assets گزینهٔ میزبانی اولیهٔ فایل‌های build است. شیوهٔ نهایی اتصال فایل‌های استاتیک به Worker و routing باید در نمونهٔ اجرایی بررسی شود.

## 4. مرز بک‌اند

Hono روی Cloudflare Workers گزینهٔ پایه برای API است؛ نسخهٔ دقیق و سازگاری کتابخانه‌ها باید در PoC آزموده شود. Backend در ابتدا یک Worker با ماژول‌های دامنه‌ای است.

مرزهای داخلی:

- Transport: routeها، webhook و serialization پاسخ
- Application: use caseها و orchestration
- Domain: قواعد یادگیری و مدل‌ها
- Ports: قرارداد دیتابیس، فایل، صف و AI
- Adapters: اتصال واقعی به D1، R2، Queues و providerها

Worker می‌تواند handlerهای HTTP و Queue را در یک استقرار ارائه دهد. جداسازی فیزیکی بعدی فقط بر اساس بار، امنیت یا چرخهٔ انتشار انجام می‌شود.

## 5. مرز دیتابیس و ذخیره‌سازی

### D1
منبع حقیقت اولیه برای داده‌های رابطه‌ای و تراکنشی: حساب، محتوای ساختاریافته، تمرین، attempt، پاسخ، پیشرفت و وضعیت jobها.

### R2
فایل‌های صوتی، تصویر و دیگر objectها. D1 فقط metadata و object key را ذخیره می‌کند. دسترسی فایل از مسیر مجاز و زمان‌دار انجام می‌شود؛ bucket خصوصی پیش‌فرض است.

### Queues
برای انتقال jobهای غیرهم‌زمان و جذب burst. پیام Queue جایگزین ثبت پایدار عملیات نیست. قبل از ارسال پیام، وضعیت job/outbox در D1 ثبت می‌شود و consumer باید idempotent باشد.

### KV و Durable Objects
در فاز نخست جزء اجباری نیستند. KV فقط برای دادهٔ cache/config مناسب با سازگاری eventual؛ Durable Objects فقط وقتی نیاز هماهنگی و state مشترک واقعی وجود داشته باشد.

## 6. طرح دادهٔ دامنه

گروه‌های اولیهٔ داده:

- Identity: کاربران، شناسه‌های Telegram، session و تنظیمات
- Content: مسیر، سطح، دوره، درس، واحد و نسخهٔ محتوا
- Assessment: تمرین، پرسش، گزینه، attempt و پاسخ
- Progress: تکمیل درس، امتیاز معتبر و رویدادهای پیشرفت
- Vocabulary: واژه‌ها، پیوند به محتوا و وضعیت مرور کاربر
- Operations: idempotency، outbox، مصرف AI و audit

ساختار نهایی جدول‌ها پس از ERD، طراحی queryهای پرتکرار و بازبینی سناریوهای حریم خصوصی تصویب می‌شود. Migration SQL مرجع نهایی ساختار است.

## 7. احراز هویت تلگرام

طبق مستندات رسمی Telegram، فقط Telegram.WebApp.initData خام باید برای اعتبارسنجی به سرور ارسال شود؛ initDataUnsafe قابل اعتماد نیست. سرور باید hash را با روش HMAC-SHA-256 مستندشده بررسی و auth_date را از نظر تازگی کنترل کند. پس از اعتبارسنجی، backend هویت داخلی و session را صادر می‌کند.

منبع: [Telegram Mini Apps — Validating data received via the Mini App](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)

## 8. سقف‌های Free که روی طراحی اثر می‌گذارند

این snapshot از صفحات رسمی در **۲۶ نوامبر ۲۰۲۶** بررسی شده است. اعداد باید پیش از هر فاز مجدداً بررسی شوند.

| محصول | محدودیت مرتبط در Free | پیامد طراحی |
|---|---|---|
| Workers | ۱۰۰٬۰۰۰ درخواست در روز و ۱۰ ms CPU برای هر درخواست HTTP | پردازش CPU-heavy از مسیر تعاملی خارج شود؛ endpointها سبک بمانند |
| D1 | ۵۰۰ MB برای هر دیتابیس، ۵ GB مجموع فضای حساب، حداکثر ۱۰ دیتابیس و ۵۰ query در هر invocation Worker | queryها کوتاه، batch و indexها سنجیده؛ تعداد queryهای متوالی کنترل شود |
| D1 concurrency | هر دیتابیس queryها را تک‌ریسمانی پردازش می‌کند | یک D1 واحد را بدون آزمون برای ترافیک جهانی بزرگ کافی فرض نکنیم |
| Queues | retention در پلن Free برابر ۲۴ ساعت و غیرقابل تنظیم | job مهم باید در D1 قابل بازیابی باشد؛ Queue تنها منبع وضعیت نباشد |
| Workers AI | تخصیص رایگان ۱۰٬۰۰۰ Neurons در روز؛ عبور از آن در Free باعث خطا/توقف درخواست می‌شود | AI سهمیه‌دار، قابل خاموش‌کردن و غیرمسیر حیاتی باشد |

منابع رسمی:
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Queues limits](https://developers.cloudflare.com/queues/platform/limits/)
- [Queues pricing and retention](https://developers.cloudflare.com/queues/platform/pricing/)
- [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)

## 9. مقیاس‌پذیری و هدف جهانی

هدف بلندمدت محصول جهانی است؛ اما Free tier برای یک میلیون کاربر فعال روزانه به‌عنوان ظرفیت قابل اتکا پذیرفته نمی‌شود. یک D1 database ذاتاً تک‌ریسمانی است. مسیر رشد پیشنهادی:

1. اندازه‌گیری query duration، صف انتظار، نرخ خطا و حجم read/write.
2. کاهش round-tripها، queryهای parameterized، indexهای ضروری و استفاده از batch.
3. جداسازی read workload یا استفاده از قابلیت‌های replication فقط پس از آزمون.
4. در صورت bottleneck پایدار، طراحی partitioning/چند دیتابیس با کلید تقسیم مشخص و migration قابل کنترل.
5. جداسازی داده‌های تحلیلی از دیتابیس تراکنشی.
6. load test با الگوی واقعی کاربران و جغرافیای هدف، پیش از هر ادعای ظرفیت.

هیچ عدد DAU یا SLA در این مرحله تضمین نمی‌شود.

## 10. الگوی پردازش پس‌زمینه

1. عملیات و شناسهٔ idempotency در D1 ثبت می‌شود.
2. رکورد outbox/job با وضعیت قابل بازیابی ذخیره می‌شود.
3. پیام Queue فقط شناسهٔ job و حداقل دادهٔ لازم را حمل می‌کند.
4. consumer وضعیت job را بررسی و پردازش را انجام می‌دهد.
5. نتیجه در D1 ثبت و job نهایی می‌شود.
6. پیام تکراری نباید باعث ثبت تکراری پاسخ، مصرف دوبارهٔ اعتبار یا ارسال چندبارهٔ نتیجه شود.

## 11. مواردی که فعلاً وارد معماری نمی‌شوند

- Microservices و Kubernetes
- Redis یا دیتابیس خارجی
- Durable Objects بدون نیاز هماهنگی اثبات‌شده
- Vectorize، AI Search و RAG پیش از وجود نیاز جست‌وجوی معنایی
- سرویس پولی یا پلن ارتقایافته
- pipeline پیچیدهٔ صوت و speech recognition پیش از benchmark کیفیت/هزینه

## 12. معیارهای پذیرش پیش از شروع انتشار

- PoC فرانت‌اند و Workers Static Assets
- PoC Hono و API روی Workers
- آزمون اعتبارسنجی Telegram initData و auth_date
- D1 migration، transaction/batch، query plan و recovery
- تست idempotency و retry برای jobها
- آزمون upload/download مجاز R2
- تست امنیت session، rate limit و دسترسی
- تست load و رفتار در اتمام سهمیه
- مستند بودن rollback/recovery و روش توقف قابلیت‌های AI
