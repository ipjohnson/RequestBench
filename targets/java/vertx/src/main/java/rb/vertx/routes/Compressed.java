package rb.vertx.routes;

import io.vertx.core.buffer.Buffer;
import io.vertx.ext.web.Router;
import rb.domain.Domain;
import rb.domain.Json;

/**
 * compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
 *
 * Vert.x enables compression on the HttpServer, which would put a "did the client ask?"
 * check on all forty-five endpoints and contaminate the rows this family is measured
 * against. A handler ahead of the endpoint's own on these three routes is the scoped
 * facility, and the codec is the pinned one every language shares.
 */
public final class Compressed {
  private Compressed() {}

  /** The floor the Java stacks use, so gzip_small lands on the same side of it. */
  // rb:wiring compressed.*
  private static final int THRESHOLD = 1024;

  public static void register(Router router) {
    // rb:handler compressed.*
    for (String size : new String[] {"small", "medium", "large"}) {
      router.get("/compressed/" + size).handler(ctx -> {
        byte[] raw = Json.bytes(Domain.payload(size));
        String accept = ctx.request().getHeader("accept-encoding");
        boolean wanted = accept != null && accept.contains("gzip") && raw.length >= THRESHOLD;
        byte[] out = wanted ? Domain.gzip(raw) : raw;
        var response = ctx.response()
            .setStatusCode(200)
            .putHeader("content-type", "application/json")
            .putHeader("x-rb-serial", Domain.nextSerial())
            .putHeader("content-length", Integer.toString(out.length));
        if (wanted) {
          response.putHeader("content-encoding", "gzip").putHeader("vary", "Accept-Encoding");
        }
        response.end(Buffer.buffer(out));
      });
    }
  }
}
