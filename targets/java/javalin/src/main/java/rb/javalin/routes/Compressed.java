package rb.javalin.routes;

import io.javalin.config.JavalinConfig;
import rb.domain.Domain;

/**
 * compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
 *
 * These routes answer with the payload and nothing else. Whether it goes out gzipped is
 * decided by Javalin's own compression, which Main.configure sets for the whole server.
 */
public final class Compressed {
  private Compressed() {}

  public static void register(JavalinConfig cfg) {
    // rb:handler compressed.*
    for (String size : new String[] {"small", "medium", "large"}) {
      cfg.routes.get("/compressed/" + size, ctx -> {
        ctx.header("x-rb-serial", Domain.nextSerial());
        ctx.json(Domain.payload(size));
      });
    }
  }
}
