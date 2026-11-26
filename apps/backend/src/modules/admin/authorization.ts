import type { MiddlewareHandler } from "hono";
import type { AppBindings } from "../../env";
import { errorBody } from "../../shared/errors";

export type AdminRole = "admin" | "content_author" | "content_reviewer" | "support";

/** Must be mounted after requireAuth. Role grants are read only from D1. */
export function requireRole(role: AdminRole): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const user = c.get("user");
    if (!user) {
      return c.json(errorBody("UNAUTHENTICATED", "A valid session is required.", c.get("requestId")), 401);
    }
    if (!c.env.DB) {
      return c.json(errorBody("AUTHORIZATION_UNAVAILABLE", "Authorization storage is unavailable.", c.get("requestId")), 503);
    }
    try {
      const grant = await c.env.DB.prepare(
        "SELECT 1 AS allowed FROM user_roles WHERE user_id=? AND role=? AND revoked_at IS NULL LIMIT 1"
      ).bind(user.id, role).first<{ allowed: number }>();
      if (!grant) {
        return c.json(errorBody("FORBIDDEN", "This operation requires an additional role.", c.get("requestId")), 403);
      }
      await next();
    } catch {
      return c.json(errorBody("AUTHORIZATION_UNAVAILABLE", "Authorization could not be verified.", c.get("requestId")), 503);
    }
  };
}
