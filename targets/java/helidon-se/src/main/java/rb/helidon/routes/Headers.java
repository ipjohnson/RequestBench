package rb.helidon.routes;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.helidon.http.HeaderName;
import io.helidon.http.HeaderNames;
import io.helidon.http.ServerRequestHeaders;
import io.helidon.webserver.http.HttpRouting;
import rb.domain.Domain;

/**
 * headers: the request header map, left unread and then bound.
 *
 * /headers reads no header at all, so headers.many minus headers.few is the cost of
 * materialising the 25 nobody asked for. /headers/bind reads three with Helidon's own
 * binding: req.headers().get(name) answers the header as a Value, and asInt() runs the mapper
 * Helidon registers for the type, the way the query family converts.
 */
public final class Headers {
  private Headers() {}

  private static final HeaderName TENANT = HeaderNames.create("x-rb-tenant");
  private static final HeaderName REQUEST_ID = HeaderNames.create("x-rb-request-id");
  private static final HeaderName ACCOUNT = HeaderNames.create("x-rb-account");

  record Bound(String tenant, @JsonProperty("request_id") String requestId, int account) {}

  public static void register(HttpRouting.Builder r) {
    r.get("/headers", (req, res) -> res.send(Domain.payload("small")));

    r.get("/headers/bind", (req, res) -> {
      ServerRequestHeaders h = req.headers();
      res.send(Domain.withEcho("small", new Bound(
          h.get(TENANT).get(), h.get(REQUEST_ID).get(), h.get(ACCOUNT).asInt().get())));
    });
  }
}
