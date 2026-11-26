import { serve } from "@hono/node-server";
import { app } from "./app";
import type { D1Database, D1PreparedStatement } from "./env";

const demoLessons = [
  { id: "lesson-greetings", title: "Greetings and introductions", level: "A1", position: 1 },
  { id: "lesson-everyday-verbs", title: "Everyday verbs", level: "A1", position: 2 },
  { id: "lesson-simple-present", title: "The simple present", level: "A1", position: 3 }
];

const demoQuestions = [{
  id: "q-greetings-1",
  prompt: "Choose the correct greeting for the morning.",
  options_json: '[{"id":"a","text":"Good morning"},{"id":"b","text":"Good night"},{"id":"c","text":"Goodbye"}]',
  answer_key: "a",
  explanation: "Use “Good morning” when greeting someone in the morning."
}];

// Local-only in-memory fixture. The Worker entrypoint never uses this in production.
const demoDatabase: D1Database = {
  prepare(query: string): D1PreparedStatement {
    let values: unknown[] = [];
    const statement: D1PreparedStatement = {
      bind(...nextValues: unknown[]) {
        values = nextValues;
        return statement;
      },
      all: async <T>() => {
        if (query.includes("FROM questions")) {
          if (query.includes("answer_key") && query.includes("WHERE id = ?")) {
            const [questionId, lessonId] = values;
            return { results: demoQuestions.filter((q) => q.id === questionId && lessonId === "lesson-greetings").map(({ id, answer_key, explanation }) => ({ id, answer_key, explanation })) as T[] };
          }
          return { results: demoQuestions as T[] };
        }
        if (query.includes("WHERE id = ?")) {
          return { results: demoLessons.filter((lesson) => lesson.id === values[0]) as T[] };
        }
        return { results: demoLessons as T[] };
      }
    };
    return statement;
  }
};

const port = Number(process.env.PORT ?? 8787);
serve({
  fetch: (request) => app.fetch(request, { DB: demoDatabase }),
  port
}, (info) => {
  console.log(`EnglishCodeApp API listening on http://localhost:${info.port} (demo data)`);
});
