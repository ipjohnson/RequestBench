package rb.javalin.routes;

import io.javalin.config.JavalinConfig;
import rb.domain.Domain;
import rb.hosts.Views;

/**
 * template: server-side rendering of the same model the json family serializes.
 *
 * The engine is jmustache, shared with every other Java target and named on /__meta.
 */
public final class Templates {
  private Templates() {}

  public static void register(JavalinConfig cfg) {
    cfg.routes.get("/template/small",
                   ctx -> ctx.contentType("text/html")
                             .result(Views.renderItems(Domain.payload("small"))));

    cfg.routes.get("/template/medium",
                   ctx -> ctx.contentType("text/html")
                             .result(Views.renderItems(Domain.payload("medium"))));
  }
}
