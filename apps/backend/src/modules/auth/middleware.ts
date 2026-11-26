import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../../env";
import { AppError } from "../../shared/errors";
import { hashSessionToken } from "./session";
import { sessionRepository } from "./repository";

export const requireSession = createMiddleware<AppEnv>(async (c, next) => {
  const authorization = c.req.header("Authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization);
  if (!match) throw new AppError("UNAUTHENTICATED", "Authentication is required.", 401);

  const tokenHash = await hashSessionToken(match[1]);
  const nowIso = new Date().toISOString();
  const session = await sessionRepository.findActive(c.env.DB, tokenHash, nowIso);
  if (!session) throw new AppError("UNAUTHENTICATED", "Authentication is required.", 401);

  c.set("userId", session.user_id);
  c.set("sessionId", session.id);
  await next();
});
