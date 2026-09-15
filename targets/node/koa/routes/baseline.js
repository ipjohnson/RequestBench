// baseline: dispatch floor, no serialization.
export default function baseline(router, { meta }) {
  router.get("/plaintext", (ctx) => { ctx.type = "text/plain"; ctx.body = "Hello, World!"; });

  router.get("/health", (ctx) => { ctx.type = "text/plain"; ctx.body = "ok"; });

  router.get("/__meta", (ctx) => { ctx.body = meta(); });
}
