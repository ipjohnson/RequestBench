package rb.helidon.routes;

import io.helidon.webserver.http.HttpRouting;
import io.helidon.webserver.http.ServerRequest;
import rb.domain.Model.QueryMany;
import rb.domain.Model.QueryOne;

/**
 * query: query string parsing and coercion, isolated from any use of the values.
 *
 * Helidon's own binding: req.query().first(name) answers an OptionalValue, and asInt() runs
 * the mapper Helidon registers for the type. orElse is what an absent one is; a value the
 * mapper refuses is a MapperException, which is Helidon's own answer and not this
 * repository's.
 */
public final class Query {
  private Query() {}

  static int qint(ServerRequest req, String name, int fallback) {
    return req.query().first(name).asInt().orElse(fallback);
  }

  static String qstr(ServerRequest req, String name) {
    return req.query().first(name).orElse("");
  }

  public static void register(HttpRouting.Builder r) {
    r.get("/query/one", (req, res) -> res.send(new QueryOne(qint(req, "page", 0))));

    r.get("/query/many", (req, res) -> res.send(new QueryMany(
        qint(req, "page", 0), qint(req, "size", 0), qstr(req, "status"),
        qstr(req, "category"), qstr(req, "sort"), qstr(req, "q"),
        qint(req, "min_price", 0), qint(req, "max_price", 0))));
  }
}
