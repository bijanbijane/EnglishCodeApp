interface Env {
  BACKEND: Fetcher;
}

function requestId(request: Request): string {
  return request.headers.get("cf-ray") ?? crypto.randomUUID();
}

function jsonError(status: number, code: string, message: string, id: string): Response {
  return Response.json(
    { error: { code, message, requestId: id } },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Request-Id": id,
      },
    },
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const id = requestId(request);

    if (!url.pathname.startsWith("/api/")) {
      return jsonError(404, "NOT_FOUND", "The requested resource was not found.", id);
    }

    try {
      const upstream = await env.BACKEND.fetch(request);
      const headers = new Headers(upstream.headers);
      headers.set("Cache-Control", "no-store");
      headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("X-Request-Id", id);

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers,
      });
    } catch {
      return jsonError(502, "UPSTREAM_UNAVAILABLE", "The application API is temporarily unavailable.", id);
    }
  },
};
