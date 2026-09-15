package rb.javalin.routes;

import io.javalin.config.JavalinConfig;
import rb.hosts.Hosts;

/** baseline: dispatch floor, no serialization. */
public final class Baseline {
  private Baseline() {}

  public static void register(JavalinConfig cfg) {
    cfg.routes.get("/plaintext", ctx -> ctx.contentType("text/plain").result("Hello, World!"));

    cfg.routes.get("/health", ctx -> ctx.contentType("text/plain").result("ok"));

    cfg.routes.get("/__meta", ctx -> ctx.json(Hosts.meta("javalin", Hosts.version("javalin"))));
  }
}
