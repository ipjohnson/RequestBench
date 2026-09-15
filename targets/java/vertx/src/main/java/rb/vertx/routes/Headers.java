package rb.vertx.routes;

import io.vertx.ext.web.Router;
import rb.domain.Domain;
import rb.vertx.Reply;

/**
 * headers: eager against lazy construction of the request header map.
 *
 * The handler reads no header at all, so headers.many minus headers.few is the cost of
 * materialising 27 nobody asked for.
 */
public final class Headers {
  private Headers() {}

  public static void register(Router router) {
    router.get("/headers").handler(ctx -> Reply.json(ctx, 200, Domain.payload("small")));
  }
}
