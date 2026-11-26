import { Hono } from "hono";
import type { AppBindings } from "../../env";
import { errorBody } from "../../shared/errors";
import { requireAuth } from "../auth/middleware";

export const userRoutes = new Hono<AppBindings>();
userRoutes.use("/me", requireAuth);
userRoutes.use("/me/*", requireAuth);

userRoutes.get("/me", (c) => {
  const user = c.get("user");
  return c.json({ data: { id: user.id, displayName: user.displayName } });
});

userRoutes.get("/me/progress", async (c) => {
  if (!c.env.DB) return c.json(errorBody("DATABASE_UNAVAILABLE", "Progress storage is unavailable.", c.get("requestId")), 503);
  const rows = await c.env.DB.prepare(`SELECT lesson_id,best_score,completed_count,last_completed_at
    FROM user_progress WHERE user_id=? ORDER BY last_completed_at DESC LIMIT 100`)
    .bind(c.get("user").id).all<{ lesson_id: string; best_score: number; completed_count: number; last_completed_at: string | null }>();
  return c.json({ data: rows.results ?? [] });
});
