package rb.helidon.routes;

import io.helidon.webserver.http.HttpRouting;
import rb.domain.Domain;
import rb.helidon.Reply;

/**
 * query: query string parsing and coercion, isolated from any use of the values.
 *
 * Helidon parses req.query(), which is the work this family measures; the domain coerces
 * what it parsed, so every target in the language answers the same values.
 */
public final class Query {
  private Query() {}

  public static void register(HttpRouting.Builder r) {
    r.get("/query/one", (req, res) -> res.send(Domain.coerceOne(Reply.query(req))));

    r.get("/query/many", (req, res) -> res.send(Domain.coerceMany(Reply.query(req))));
  }
}
