export interface Env {
  DB: D1Database;
  AI: Ai;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  TELEGRAM_SETUP_KEY?: string;
  APP_ENV?: "local" | "development" | "staging" | "production";
  ALLOWED_ORIGINS?: string;
}
export type AppVariables = { requestId: string; userId: string; sessionId: string };
export type AppEnv = { Bindings: Env; Variables: AppVariables };
