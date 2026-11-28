# Database Seeds

Seedها فقط برای داده‌های پایه و قابل تکرار هستند؛ مانند سطوح زبان، دسته‌بندی تمرین یا محتوای نمونه‌ای که مجوز استفاده از آن روشن است.

- seed نباید حساب واقعی، token، دادهٔ شخصی یا اطلاعات محرمانه داشته باشد.
- دادهٔ آموزشی باید منبع، مجوز و نسخه داشته باشد.
- seed باید idempotent باشد تا اجرای دوباره باعث دادهٔ تکراری نشود.
- دادهٔ نمونه و fixtureهای تست از دادهٔ production جدا نگه داشته شوند.
- محتوا نباید صرفاً به دلیل وجود در seed به‌عنوان محتوای نهایی و تأییدشده معرفی شود.


## A1 Foundations curriculum seed

After applying migrations 0001–0015 and running the base demo seed, apply the original A1 Unit 1 content:

- Local: from `apps/backend`, run `npm run db:seed:a1:local`.
- The local commands use the `englishcodeapp-dev` D1 database name from `wrangler.jsonc` with Wrangler's local persistence; they do not access the remote development database.
- Development remote: from `apps/backend`, run `npm run db:seed:a1:dev` only after verifying the target database and obtaining explicit owner approval for that remote write.
- The seed creates one A1 course, five lessons and twenty deterministic multiple-choice questions. It is idempotent and publishes each lesson only after its four question versions exist.
- Teaching notes, vocabulary focus, model dialogues, communicative tasks and editorial methodology are documented in `docs/curriculum/A1-FOUNDATIONS-UNIT-01.md`.
- Do not run the A1 seed before migrations and the base seed. It does not contain audio assets or AI/API dependencies.
