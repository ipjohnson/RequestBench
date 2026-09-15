package rb.javalin.routes;

import io.javalin.config.JavalinConfig;
import rb.domain.Domain;
import rb.javalin.Support;

/**
 * query: query string parsing and coercion, isolated from any use of the values.
 *
 * Javalin parses ctx.queryParamMap(), which is the work this family measures; the domain
 * coerces what it parsed, so every target in the language answers the same values.
 */
public final class Query {
  private Query() {}

  public static void register(JavalinConfig cfg) {
    cfg.routes.get("/query/one", ctx -> ctx.json(Domain.coerceOne(Support.query(ctx))));

    cfg.routes.get("/query/many", ctx -> ctx.json(Domain.coerceMany(Support.query(ctx))));
  }
}
