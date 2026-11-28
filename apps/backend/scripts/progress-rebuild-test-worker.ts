import { rebuildUserProgressFromEvents } from "../src/modules/maintenance/progress";

interface Env {
  DB: D1Database;
}

export default {
  async fetch(_request: Request, env: Env): Promise<Response> {
    try {
      const results = await rebuildUserProgressFromEvents(env.DB);
      return Response.json({
        ok: true,
        changes: results.map((result) => result.meta.changes),
      });
    } catch {
      // Do not leak SQL, bindings, or database details from the test harness.
      return Response.json({ ok: false, error: "progress_rebuild_failed" }, { status: 500 });
    }
  },
};
