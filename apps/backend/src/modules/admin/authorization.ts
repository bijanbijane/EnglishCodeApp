import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../../env";
import { AppError } from "../../shared/errors";

export type AdminRole = "admin" | "content_author" | "content_reviewer" | "support";

export function requireRole(role: AdminRole) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const userId = c.get("userId");
    try {
      const grant = await c.env.DB.prepare(
        "SELECT 1 AS allowed FROM user_roles WHERE user_id=? AND role=? AND revoked_at IS NULL LIMIT 1",
      ).bind(userId, role).first<{ allowed: number }>();

      if (!grant) {
        throw new AppError("FORBIDDEN", "This operation requires an additional role.", 403);
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("SERVICE_UNAVAILABLE", "Authorization could not be verified.", 503);
    }
    await next();
  });
}
