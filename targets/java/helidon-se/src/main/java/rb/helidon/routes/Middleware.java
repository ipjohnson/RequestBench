package rb.helidon.routes;

import io.helidon.webserver.http.HttpRouting;
import rb.domain.Domain;

/**
 * middleware: per-layer dispatch cost at 0, 4 and 16 no-op layers.
 *
 * Helidon takes a filter on a path, which is the scoping the family needs. Each layer calls
 * the chain and does nothing else.
 */
public final class Middleware {
  private Middleware() {}

  private static void layered(HttpRouting.Builder r, String path, int n) {
    for (int i = 0; i < n; i++) {
      r.route(io.helidon.webserver.http.HttpRoute.builder()
          .path(path)
          .handler((req, res) -> res.next())
          .build());
    }
    r.get(path, (req, res) -> res.send(Domain.payload("small")));
  }

  public static void register(HttpRouting.Builder r) {
    r.get("/middleware/none", (req, res) -> res.send(Domain.payload("small")));

    // rb:snippet middleware.four
    layered(r, "/middleware/four", 4);

    // rb:snippet middleware.sixteen
    layered(r, "/middleware/sixteen", 16);
  }
}
