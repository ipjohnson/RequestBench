package rb.helidon.routes;

import io.helidon.webserver.http.HttpRouting;
import rb.domain.Domain;
import rb.hosts.Views;

/**
 * template: server-side rendering of the same model the json family serializes.
 *
 * The engine is jmustache, shared with every other Java target and named on /__meta.
 */
public final class Templates {
  private Templates() {}

  public static void register(HttpRouting.Builder r) {
    r.get("/template/small", (req, res) -> res.header("content-type", "text/html")
        .send(Views.renderItems(Domain.payload("small"))));

    r.get("/template/medium", (req, res) -> res.header("content-type", "text/html")
        .send(Views.renderItems(Domain.payload("medium"))));
  }
}
