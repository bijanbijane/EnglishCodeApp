import { Hono } from "hono";
import type { Env } from "./env";

export const app = new Hono<{ Bindings: Env }>();

app.get("/api/v1/health", (c) => {
  return c.json({
    ok: true,
    service: "englishcode-backend",
    version: "v1"
  });
});

app.get("/api/v1/lessons", async (c) => {
  if (!c.env.DB) {
    return c.json({ error: { code: "DATABASE_UNAVAILABLE", message: "Lesson storage is not configured." } }, 503);
  }

  try {
    const result = await c.env.DB.prepare(
      "SELECT id, title, level, position FROM lessons WHERE status = 'published' ORDER BY position ASC LIMIT 50"
    ).all<{ id: string; title: string; level: string; position: number }>();

    return c.json({ data: result.results ?? [] });
  } catch {
    return c.json({ error: { code: "LESSONS_UNAVAILABLE", message: "Lessons could not be loaded." } }, 503);
  }
});

app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Route not found." } }, 404));

app.onError((error, c) => {
  console.error(JSON.stringify({ level: "error", message: error.message }));
  return c.json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } }, 500);
});
