package rb.helidon.routes;

import io.helidon.webserver.http.HttpRouting;
import rb.domain.Domain;

/**
 * compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
 *
 * These routes answer with the payload and nothing else. Whether it goes out gzipped is
 * decided by the WebServer's own content encoding, which Main.server turns on.
 */
public final class Compressed {
  private Compressed() {}

  public static void register(HttpRouting.Builder r) {
    // rb:handler compressed.*
    for (String size : new String[] {"small", "medium", "large"}) {
      r.get("/compressed/" + size, (req, res) -> {
        res.header("x-rb-serial", Domain.nextSerial());
        res.send(Domain.payload(size));
      });
    }
  }
}
