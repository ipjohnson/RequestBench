package rb.helidon.routes;

import io.helidon.webserver.http.HttpRouting;
import rb.domain.Domain;

/**
 * json: the serializer and response buffering across three size regimes.
 *
 * Three static routes, not /json/{size}. The size set is fixed, so a capture would make the
 * router pay parameter cost on the family every other target serves from a static route.
 */
public final class JsonRoutes {
  private JsonRoutes() {}

  public static void register(HttpRouting.Builder r) {
    r.get("/json/small", (req, res) -> res.send(Domain.payload("small")));

    r.get("/json/medium", (req, res) -> res.send(Domain.payload("medium")));

    r.get("/json/large", (req, res) -> res.send(Domain.payload("large")));
  }
}
