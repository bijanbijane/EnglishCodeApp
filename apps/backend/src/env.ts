export interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  APP_ENV?: "local" | "staging" | "production";
  ALLOWED_ORIGINS?: string;
}

export type AppVariables = {
  requestId: string;
};

export type AppEnv = {
  Bindings: Env;
  Variables: AppVariables;
};
