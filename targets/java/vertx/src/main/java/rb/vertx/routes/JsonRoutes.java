package rb.vertx.routes;

import io.vertx.ext.web.Router;
import rb.domain.Domain;
import rb.vertx.Reply;

/**
 * json: the serializer and response buffering across three size regimes.
 *
 * Three static routes, not /json/:size. The size set is fixed, so a capture would make the
 * router pay parameter cost on the family every other target serves from a static route.
 */
public final class JsonRoutes {
  private JsonRoutes() {}

  public static void register(Router router) {
    router.get("/json/small").handler(ctx -> Reply.json(ctx, 200, Domain.payload("small")));

    router.get("/json/medium").handler(ctx -> Reply.json(ctx, 200, Domain.payload("medium")));

    router.get("/json/large").handler(ctx -> Reply.json(ctx, 200, Domain.payload("large")));
  }
}
