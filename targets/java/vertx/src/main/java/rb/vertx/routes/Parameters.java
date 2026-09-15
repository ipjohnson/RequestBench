package rb.vertx.routes;

import io.vertx.ext.web.Router;
import rb.domain.Domain;
import rb.vertx.Reply;

/** parameters: router captures with segment depth held constant. */
public final class Parameters {
  private Parameters() {}

  public static void register(Router router) {
    router.get("/parameters/static/segment/literal")
          .handler(ctx -> Reply.json(ctx, 200, Domain.payload("small")));

    router.get("/parameters/:one")
          .handler(ctx -> Reply.json(ctx, 200, Domain.payload("small")));

    router.get("/parameters/:one/with-second/:two")
          .handler(ctx -> Reply.json(ctx, 200, Domain.payload("small")));
  }
}
