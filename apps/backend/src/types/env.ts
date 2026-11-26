type RuntimeSecrets = {
  TELEGRAM_BOT_TOKEN?: string;
  SESSION_SECRET?: string;
  TELEGRAM_MAX_AUTH_AGE_SECONDS?: string;
};

export type AppEnv = {
  Bindings: Env & RuntimeSecrets;
  Variables: { userId: string };
};