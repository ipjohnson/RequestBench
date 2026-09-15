package rb.vertx.routes;

import io.vertx.ext.web.Router;
import rb.domain.Domain;
import rb.vertx.Reply;

/**
 * authorized: the framework's authorization mechanism, crypto excluded.
 *
 * A handler ahead of the endpoint's own on the same route, not an if in the handler. An if
 * would measure the language; the point of the family is the framework's own plumbing.
 */
public final class Authorized {
  private Authorized() {}

  public static void register(Router router) {
    router.get("/authorized/small")
          .handler(ctx -> {
            if (!Domain.tokenOk(ctx.request().getHeader("authorization"))) {
              Reply.json(ctx, 403, Domain.forbiddenBody());
              return;
            }
            ctx.next();
          })
          .handler(ctx -> Reply.json(ctx, 200, Domain.payload("small")));
  }
}
