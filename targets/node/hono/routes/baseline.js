// baseline: dispatch floor, no serialization.
export default function baseline(app, { meta }) {
  app.get("/plaintext", (c) => c.text("Hello, World!"));

  app.get("/health", (c) => c.text("ok"));

  app.get("/__meta", (c) => c.json(meta()));
}
