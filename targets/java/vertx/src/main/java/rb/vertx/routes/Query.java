package rb.vertx.routes;

import io.vertx.ext.web.Router;
import rb.domain.Domain;
import rb.vertx.Reply;

/**
 * query: query string parsing and coercion, isolated from any use of the values.
 *
 * Vert.x parses ctx.queryParams(), which is the work this family measures; the domain
 * coerces what it parsed, so every target in the language answers the same values.
 */
public final class Query {
  private Query() {}

  public static void register(Router router) {
    router.get("/query/one")
          .handler(ctx -> Reply.json(ctx, 200, Domain.coerceOne(Reply.query(ctx))));

    router.get("/query/many")
          .handler(ctx -> Reply.json(ctx, 200, Domain.coerceMany(Reply.query(ctx))));
  }
}
