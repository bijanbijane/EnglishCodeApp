import { Hono } from "hono";
import type { AppEnv } from "../../env";
import { requireSession } from "./middleware";
import { sessionRepository } from "./repository";

const auth = new Hono<AppEnv>();

auth.post("/auth/logout", requireSession, async (c) => {
  const revoked = await sessionRepository.revoke(
    c.env.DB,
    c.get("sessionId"),
    c.get("userId"),
    new Date().toISOString(),
  );
  return c.json({
    data: { loggedOut: revoked },
    meta: { requestId: c.get("requestId") },
  });
});

export default auth;
