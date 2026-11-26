import { app } from "./app";
import type { Env } from "./env";

export default {
  fetch(request: Request, env: Env): Response | Promise<Response> {
    return app.fetch(request, env);
  }
};
