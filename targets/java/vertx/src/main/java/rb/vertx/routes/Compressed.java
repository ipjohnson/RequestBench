package rb.vertx.routes;

import io.vertx.ext.web.Router;
import rb.domain.Domain;
import rb.vertx.Reply;

/**
 * compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
 *
 * These routes answer with the payload and nothing else. Whether it goes out gzipped is
 * decided by the HttpServer's own compression, which Main.options() turns on for every route.
 */
public final class Compressed {
  private Compressed() {}

  public static void register(Router router) {
    // rb:handler compressed.*
    for (String size : new String[] {"small", "medium", "large"}) {
      router.get("/compressed/" + size).handler(ctx -> {
        ctx.response().putHeader("x-rb-serial", Domain.nextSerial());
        Reply.json(ctx, 200, Domain.payload(size));
      });
    }
  }
}
