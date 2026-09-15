package rb.javalin.routes;

import io.javalin.config.JavalinConfig;
import rb.domain.Domain;

/**
 * json: the serializer and response buffering across three size regimes.
 *
 * Three static routes, not /json/{size}. The size set is fixed, so a capture would make the
 * router pay parameter cost on the family every other target serves from a static route,
 * and it would answer 200 with an empty body for a size that does not exist.
 */
public final class JsonRoutes {
  private JsonRoutes() {}

  public static void register(JavalinConfig cfg) {
    cfg.routes.get("/json/small", ctx -> ctx.json(Domain.payload("small")));

    cfg.routes.get("/json/medium", ctx -> ctx.json(Domain.payload("medium")));

    cfg.routes.get("/json/large", ctx -> ctx.json(Domain.payload("large")));
  }
}
