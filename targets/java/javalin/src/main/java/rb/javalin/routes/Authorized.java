package rb.javalin.routes;

import io.javalin.config.JavalinConfig;
import rb.domain.Domain;

/**
 * authorized: the framework's authorization mechanism, crypto excluded.
 *
 * A before handler bound to this path, not an if in the handler. An if would measure the
 * language; the point of the family is the framework's own plumbing. Javalin refuses a
 * request from a before handler by skipping ahead, which is what the exception does.
 */
public final class Authorized {
  private Authorized() {}

  public static void register(JavalinConfig cfg) {
    cfg.routes.before("/authorized/small", ctx -> {
      if (!Domain.tokenOk(ctx.header("authorization"))) {
        ctx.status(403).json(Domain.forbiddenBody()).skipRemainingHandlers();
      }
    });

    // rb:snippet authorized.allowed authorized.denied
    cfg.routes.get("/authorized/small", ctx -> ctx.json(Domain.payload("small")));
  }
}
