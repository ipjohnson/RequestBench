package rb.vertx.routes;

import io.vertx.ext.web.Router;
import rb.domain.Domain;
import rb.vertx.Reply;

/**
 * middleware: per-layer dispatch cost at 0, 4 and 16 no-op layers.
 *
 * Vert.x chains handlers on a route, which is the scoping the family needs. Each layer
 * calls next and does nothing else.
 */
public final class Middleware {
  private Middleware() {}

  private static void layered(Router router, String path, int n) {
    var route = router.get(path);
    for (int i = 0; i < n; i++) {
      route.handler(ctx -> ctx.next());
    }
    route.handler(ctx -> Reply.json(ctx, 200, Domain.payload("small")));
  }

  public static void register(Router router) {
    router.get("/middleware/none")
          .handler(ctx -> Reply.json(ctx, 200, Domain.payload("small")));

    // rb:snippet middleware.four
    layered(router, "/middleware/four", 4);

    // rb:snippet middleware.sixteen
    layered(router, "/middleware/sixteen", 16);
  }
}
