// baseline: dispatch floor, no serialization.
export default function baseline(app, { meta }) {
  app.get("/plaintext", (_, res) => res.type("text/plain").send("Hello, World!"));

  app.get("/health", (_, res) => res.type("text/plain").send("ok"));

  app.get("/__meta", (_, res) => res.json(meta()));
}
