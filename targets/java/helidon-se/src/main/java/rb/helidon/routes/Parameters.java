package rb.helidon.routes;

import io.helidon.webserver.http.HttpRouting;
import rb.domain.Domain;

/** parameters: router captures with segment depth held constant. */
public final class Parameters {
  private Parameters() {}

  public static void register(HttpRouting.Builder r) {
    r.get("/parameters/static/segment/literal", (req, res) -> res.send(Domain.payload("small")));

    r.get("/parameters/{one}", (req, res) -> res.send(Domain.payload("small")));

    r.get("/parameters/{one}/with-second/{two}", (req, res) -> res.send(Domain.payload("small")));
  }
}
