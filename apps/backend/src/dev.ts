import { serve } from "@hono/node-server";
import { app } from "./app";
import type { D1Database, D1PreparedStatement } from "./env";

const demoLessons = [
  { id: "lesson-greetings", title: "Greetings and introductions", level: "A1", position: 1 },
  { id: "lesson-everyday-verbs", title: "Everyday verbs", level: "A1", position: 2 },
  { id: "lesson-simple-present", title: "The simple present", level: "A1", position: 3 }
];

// Local-only fixture. The Worker entrypoint never uses this in production.
const demoDatabase: D1Database = {
  prepare(_query: string): D1PreparedStatement {
    return {
      all: async <T>() => ({ results: demoLessons as T[] })
    };
  }
};

const port = Number(process.env.PORT ?? 8787);
serve({
  fetch: (request) => app.fetch(request, { DB: demoDatabase }),
  port
}, (info) => {
  console.log(`EnglishCodeApp API listening on http://localhost:${info.port} (demo data)`);
});
