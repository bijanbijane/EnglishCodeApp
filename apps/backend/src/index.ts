import app from "./app";
import type { Env } from "./env";
import { cleanupExpiredAuthState } from "./modules/maintenance/cleanup";

export default {
  fetch: app.fetch,
  scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(cleanupExpiredAuthState(env.DB));
  },
};
