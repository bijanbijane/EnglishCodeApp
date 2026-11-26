export type AppEnv = {
  Bindings: { DB: D1Database; APP_ENV: "local" | "test" | "production"; ALLOWED_ORIGINS?: string; TELEGRAM_BOT_TOKEN?: string; SESSION_SECRET?: string; TELEGRAM_MAX_AUTH_AGE_SECONDS?: string };
  Variables: { userId: string };
};