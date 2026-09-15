package rb.vertx.routes;

import io.vertx.ext.web.Router;
import rb.domain.Domain;
import rb.hosts.Views;

/**
 * template: server-side rendering of the same model the json family serializes.
 *
 * The engine is jmustache, shared with every other Java target and named on /__meta.
 */
public final class Templates {
  private Templates() {}

  private static void render(Router router, String path, String size) {
    router.get(path).handler(ctx -> ctx.response()
        .putHeader("content-type", "text/html")
        .end(Views.renderItems(Domain.payload(size))));
  }

  public static void register(Router router) {
    render(router, "/template/small", "small");

    render(router, "/template/medium", "medium");
  }
}
