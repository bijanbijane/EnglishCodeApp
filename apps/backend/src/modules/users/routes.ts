import { Hono } from "hono";
import type { AppEnv } from "../../env";
import { requireSession } from "../auth/middleware";

type UserProfile = {
  id: string;
  display_name: string | null;
  created_at: string;
};

const users = new Hono<AppEnv>();

users.get("/me", requireSession, async (c) => {
  const profile = await c.env.DB.prepare(
    "SELECT id, display_name, created_at FROM users WHERE id = ? LIMIT 1",
  ).bind(c.get("userId")).first<UserProfile>();

  if (!profile) {
    return c.json(
      {
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication is required.",
          requestId: c.get("requestId"),
        },
      },
      401,
    );
  }

  return c.json({
    data: profile,
    meta: { requestId: c.get("requestId") },
  });
});

export default users;
