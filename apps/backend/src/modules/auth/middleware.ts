import type { MiddlewareHandler } from "hono";
import type { AppBindings } from "../../env";
import { errorBody } from "../../shared/errors";
import { findSessionUser } from "./session";

export const requireAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
  const match = c.req.header("authorization")?.match(/^Bearer ([A-Za-z0-9_-]{32,128})$/);
  if (!match || !c.env.DB) return c.json(errorBody("UNAUTHENTICATED", "A valid session is required.", c.get("requestId")), 401);
  try {
    const session = await findSessionUser(c.env.DB, match[1]);
    if (!session) return c.json(errorBody("UNAUTHENTICATED", "A valid session is required.", c.get("requestId")), 401);
    c.set("user", { id: session.id, telegramUserId: session.telegram_user_id,
      displayName: session.display_name, sessionTokenHash: session.token_hash });
    await next();
  } catch {
    return c.json(errorBody("AUTH_SERVICE_UNAVAILABLE", "Authentication is temporarily unavailable.", c.get("requestId")), 503);
  }
};
