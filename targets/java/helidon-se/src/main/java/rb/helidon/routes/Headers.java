package rb.helidon.routes;

import io.helidon.webserver.http.HttpRouting;
import rb.domain.Domain;

/**
 * headers: eager against lazy construction of the request header map.
 *
 * The handler reads no header at all, so headers.many minus headers.few is the cost of
 * materialising 27 nobody asked for.
 */
public final class Headers {
  private Headers() {}

  public static void register(HttpRouting.Builder r) {
    r.get("/headers", (req, res) -> res.send(Domain.payload("small")));
  }
}
