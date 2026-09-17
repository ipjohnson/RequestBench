package rb.vertx.routes;

import io.vertx.ext.web.Router;
import rb.hosts.Hosts;
import rb.vertx.Reply;

/** baseline: dispatch floor, no serialization. */
public final class Baseline {
  private Baseline() {}

  public static void register(Router router) {
    router.get("/plaintext").handler(ctx -> ctx.response()
        .putHeader("content-type", "text/plain").end("Hello, World!"));

    router.get("/health").handler(ctx -> ctx.response()
        .putHeader("content-type", "text/plain").end("ok"));

    router.get("/__meta").handler(ctx ->
        Reply.json(ctx, 200, Hosts.meta("vertx", Hosts.version("vertx"), "handlebars",
            "sha1 (vertx ships no conditional handling)", "a shared LRU")));
  }
}
