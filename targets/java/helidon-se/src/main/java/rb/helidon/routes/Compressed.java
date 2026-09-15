package rb.helidon.routes;

import io.helidon.webserver.http.HttpRouting;
import rb.domain.Domain;
import rb.domain.Json;

/**
 * compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
 *
 * Helidon enables content encoding on the WebServer, which would put a "did the client
 * ask?" check on all forty-five endpoints and contaminate the rows this family is measured
 * against. These three routes carry it instead, with the codec pinned across every
 * language.
 */
public final class Compressed {
  private Compressed() {}

  /** The floor the Java stacks use, so gzip_small lands on the same side of it. */
  private static final int THRESHOLD = 1024;

  public static void register(HttpRouting.Builder r) {
    // rb:snippet compressed.identity_small compressed.identity_medium
    // rb:snippet compressed.identity_large compressed.gzip_small compressed.gzip_medium
    // rb:snippet compressed.gzip_large
    for (String size : new String[] {"small", "medium", "large"}) {
      r.get("/compressed/" + size, (req, res) -> {
        byte[] raw = Json.bytes(Domain.payload(size));
        String accept = req.headers()
            .value(io.helidon.http.HeaderNames.ACCEPT_ENCODING).orElse("");
        boolean wanted = accept.contains("gzip") && raw.length >= THRESHOLD;
        byte[] out = wanted ? Domain.gzip(raw) : raw;
        res.header("content-type", "application/json");
        res.header("x-rb-serial", Domain.nextSerial());
        if (wanted) {
          res.header("content-encoding", "gzip");
          res.header("vary", "Accept-Encoding");
        }
        res.send(out);
      });
    }
  }
}
