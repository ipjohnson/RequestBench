package rb.javalin.routes;

import io.javalin.config.JavalinConfig;
import rb.domain.Domain;

/**
 * middleware: per-layer dispatch cost at 0, 4 and 16 no-op layers.
 *
 * Javalin's before handlers take a path, which is the scoping the family needs. Each layer
 * runs and does nothing else.
 */
public final class Middleware {
  private Middleware() {}

  private static void layers(JavalinConfig cfg, String path, int n) {
    for (int i = 0; i < n; i++) {
      cfg.routes.before(path, ctx -> { });
    }
    cfg.routes.get(path, ctx -> ctx.json(Domain.payload("small")));
  }

  public static void register(JavalinConfig cfg) {
    cfg.routes.get("/middleware/none", ctx -> ctx.json(Domain.payload("small")));

    // rb:snippet middleware.four
    layers(cfg, "/middleware/four", 4);

    // rb:snippet middleware.sixteen
    layers(cfg, "/middleware/sixteen", 16);
  }
}
