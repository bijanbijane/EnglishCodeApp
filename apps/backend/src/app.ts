import { Hono } from "hono";
import type { AppEnv } from "./env";
import { AppError } from "./shared/errors";

const app = new Hono<AppEnv>();

app.use("*", async (c, next) => {
  const requestId = c.req.header("cf-ray") ?? crypto.randomUUID();
  c.set("requestId", requestId);
  await next();
  c.header("X-Request-Id", requestId);
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");
  c.header("X-Frame-Options", "DENY");
});

app.get("/api/v1/health", (c) =>
  c.json({ data: { status: "ok" }, meta: { requestId: c.get("requestId") } }),
);

app.get("/api/v1/ready", async (c) => {
  try {
    await c.env.DB.prepare("SELECT 1 AS ready").first<{ ready: number }>();
    return c.json({
      data: { status: "ready", database: "ok" },
      meta: { requestId: c.get("requestId") },
    });
  } catch {
    return c.json(
      {
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "A required dependency is unavailable.",
          requestId: c.get("requestId"),
        },
      },
      503,
    );
  }
});

app.notFound((c) =>
  c.json(
    {
      error: {
        code: "NOT_FOUND",
        message: "The requested resource was not found.",
        requestId: c.get("requestId"),
      },
    },
    404,
  ),
);

app.onError((error, c) => {
  const requestId = c.get("requestId") ?? "unknown";
  if (error instanceof AppError) {
    return c.json(
      {
        error: { code: error.code, message: error.message, requestId },
      },
      error.status,
    );
  }

  // Do not serialize stack traces, SQL details, or secrets into API responses.
  return c.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
        requestId,
      },
    },
    500,
  );
});

export default app;
