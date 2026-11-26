interface Env {
  BACKEND: { fetch(request: Request): Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/api/")) {
      return new Response("Not Found", { status: 404 });
    }

    const upstream = await env.BACKEND.fetch(request);
    const response = new Response(upstream.body, upstream);
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Request-Id", request.headers.get("cf-ray") ?? crypto.randomUUID());
    return response;
  },
};
