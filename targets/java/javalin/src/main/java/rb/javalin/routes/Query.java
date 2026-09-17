package rb.javalin.routes;

import io.javalin.config.JavalinConfig;
import io.javalin.http.Context;
import rb.domain.Model.QueryMany;
import rb.domain.Model.QueryOne;

/**
 * query: query string parsing and coercion, isolated from any use of the values.
 *
 * Javalin's own binding: queryParamAsClass names the parameter and the class it wants, and
 * returns a Validator that has already run Javalin's converter for that type. getOrDefault is
 * what an absent one is; a value the converter refuses is a ValidationException, which is
 * Javalin's own 400 and not this repository's.
 */
public final class Query {
  private Query() {}

  static int qint(Context ctx, String name, int fallback) {
    return ctx.queryParamAsClass(name, Integer.class).getOrDefault(fallback);
  }

  static String qstr(Context ctx, String name) {
    return ctx.queryParamAsClass(name, String.class).getOrDefault("");
  }

  public static void register(JavalinConfig cfg) {
    cfg.routes.get("/query/one", ctx -> ctx.json(new QueryOne(qint(ctx, "page", 0))));

    cfg.routes.get("/query/many", ctx -> ctx.json(new QueryMany(
        qint(ctx, "page", 0), qint(ctx, "size", 0), qstr(ctx, "status"),
        qstr(ctx, "category"), qstr(ctx, "sort"), qstr(ctx, "q"),
        qint(ctx, "min_price", 0), qint(ctx, "max_price", 0))));
  }
}
