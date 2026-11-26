import { serve } from "@hono/node-server";
import { app } from "./app";
import type { D1Database, D1PreparedStatement } from "./env";

const demoLessons = [
  { id: "lesson-greetings", title: "Greetings and introductions", level: "A1", position: 1 },
  { id: "lesson-everyday-verbs", title: "Everyday verbs", level: "A1", position: 2 },
  { id: "lesson-simple-present", title: "The simple present", level: "A1", position: 3 }
];

// Local-only fixture: read-only lesson preview, never imported by the Worker entrypoint.
const demoDatabase = {
  prepare(_query: string): D1PreparedStatement {
    const statement = {
      bind() { return statement; },
      first: async <T>() => null as T | null,
      all: async <T>() => ({ results: demoLessons as T[] }),
      run: async () => ({ success: true, meta: { changes: 0 } })
    };
    return statement;
  },
  batch: async () => []
} as unknown as D1Database;

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: (request) => app.fetch(request, { DB: demoDatabase }), port }, (info) => {
  console.log(`EnglishCodeApp API listening on http://localhost:${info.port} (read-only demo data)`);
});
