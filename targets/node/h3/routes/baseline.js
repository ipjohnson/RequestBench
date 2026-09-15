// baseline: dispatch floor, no serialization.
export default function baseline(app, { meta }) {
  app.get("/plaintext", (e) => {
    e.res.headers.set("content-type", "text/plain; charset=utf-8");
    return "Hello, World!";
  });

  app.get("/health", (e) => {
    e.res.headers.set("content-type", "text/plain; charset=utf-8");
    return "ok";
  });

  app.get("/__meta", () => meta());
}
