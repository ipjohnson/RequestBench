package rb.helidon.routes;

import io.helidon.webserver.http.HttpRoute;
import io.helidon.webserver.http.HttpRouting;
import rb.domain.Domain;

/**
 * authorized: the framework's authorization mechanism, crypto excluded.
 *
 * A route ahead of the endpoint's own on the same path, not an if in the handler. An if
 * would measure the language; the point of the family is the framework's own plumbing.
 */
public final class Authorized {
  private Authorized() {}

  public static void register(HttpRouting.Builder r) {
    // rb:wiring authorized.*
    r.route(HttpRoute.builder().path("/authorized/small").handler((req, res) -> {
      if (!Domain.tokenOk(req.headers().value(io.helidon.http.HeaderNames.AUTHORIZATION)
                              .orElse(null))) {
        res.status(403).send(Domain.forbiddenBody());
        return;
      }
      res.next();
    }).build());

    // rb:handler authorized.*
    r.get("/authorized/small", (req, res) -> res.send(Domain.payload("small")));
  }
}
