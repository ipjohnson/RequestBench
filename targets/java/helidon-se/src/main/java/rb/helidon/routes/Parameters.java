package rb.helidon.routes;

import io.helidon.webserver.http.HttpRouting;
import io.helidon.webserver.http.ServerRequest;
import rb.domain.Domain;

/**
 * parameters: router captures with segment depth held constant.
 *
 * Helidon's own binding: req.path().pathParameters().first(name) answers an OptionalValue, and
 * asInt() runs the mapper Helidon registers for the type.
 */
public final class Parameters {
  private Parameters() {}

  record One(int one) {}

  record Two(int one, int two) {}

  static int capture(ServerRequest req, String name) {
    return req.path().pathParameters().first(name).asInt().get();
  }

  public static void register(HttpRouting.Builder r) {
    // Registered first. Helidon matches in registration order, and {one}/segment/literal
    // matches this path too.
    r.get("/parameters/static/segment/literal", (req, res) -> res.send(Domain.payload("small")));

    r.get("/parameters/{one}/segment/literal",
          (req, res) -> res.send(Domain.withEcho("small", new One(capture(req, "one")))));

    r.get("/parameters/{one}/with-second/{two}", (req, res) -> res.send(Domain.withEcho("small",
          new Two(capture(req, "one"), capture(req, "two")))));
  }
}
