import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import type { AppEnv } from "./env";
import { AppError } from "./shared/errors";
import contentRoutes from "./modules/content/routes";
import authRoutes from "./modules/auth/routes";
import userRoutes from "./modules/users/routes";
import learningRoutes from "./modules/learning/routes";
import { adminRoutes } from "./modules/admin/routes";
import adminReadRoutes from "./modules/admin/audit-routes";

const app = new Hono<AppEnv>();

app.use("*", async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set("requestId", requestId);
  try {
    await next();
  } finally {
    c.header("Cache-Control", "no-store");
    c.header("X-Request-Id", requestId);
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "no-referrer");
    c.header("X-Frame-Options", "DENY");
  }
});

app.use("/api/v1/*", bodyLimit({
  maxSize: 256 * 1024,
  onError: (context) => context.json({
    error: {
      code: "PAYLOAD_TOO_LARGE",
      message: "Request body exceeds the API size limit.",
      requestId: context.get("requestId"),
    },
  }, 413),
}));

app.use("/api/v1/*", cors({
  origin: (origin, context) => {
    const allowed = new Set(
      (context.env.ALLOWED_ORIGINS ?? "")
        .split(",")
        .map((value: string) => value.trim())
        .filter((value: string) => value.length > 0),
    );
    return allowed.has(origin) ? origin : undefined;
  },
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  exposeHeaders: ["X-Request-Id", "Retry-After"],
  maxAge: 600,
}));

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

app.route("/api/v1", contentRoutes);
app.route("/api/v1", authRoutes);
app.route("/api/v1", userRoutes);
app.route("/api/v1", learningRoutes);
app.route("/api/v1/admin", adminRoutes);
app.route("/api/v1/admin", adminReadRoutes);

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
