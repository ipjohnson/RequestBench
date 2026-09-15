package rb.javalin.routes;

import io.javalin.config.JavalinConfig;
import java.nio.charset.StandardCharsets;
import rb.domain.Domain;

/**
 * compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
 *
 * Javalin configures compression on the whole server, which would put a "did the client
 * ask?" check on all forty-five endpoints and contaminate the rows this family is measured
 * against. An after handler bound to this path is its own scoped facility, and the codec is
 * the pinned one every language shares.
 */
public final class Compressed {
  private Compressed() {}

  /** The floor the Java servlet stacks use, so gzip_small lands on the same side of it. */
  private static final int THRESHOLD = 1024;

  public static void register(JavalinConfig cfg) {
    cfg.routes.after("/compressed/*", ctx -> {
      String accept = ctx.header("accept-encoding");
      if (accept == null || !accept.contains("gzip")) {
        return;
      }
      String result = ctx.result();
      if (result == null) {
        return;
      }
      byte[] raw = result.getBytes(StandardCharsets.UTF_8);
      if (raw.length < THRESHOLD) {
        return;
      }
      ctx.header("content-encoding", "gzip");
      ctx.header("vary", "Accept-Encoding");
      ctx.result(Domain.gzip(raw));
    });

    // rb:snippet compressed.identity_small compressed.identity_medium
    // rb:snippet compressed.identity_large compressed.gzip_small compressed.gzip_medium
    // rb:snippet compressed.gzip_large
    for (String size : new String[] {"small", "medium", "large"}) {
      cfg.routes.get("/compressed/" + size, ctx -> {
        ctx.header("x-rb-serial", Domain.nextSerial());
        ctx.json(Domain.payload(size));
      });
    }
  }
}
