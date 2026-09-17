package rb.vertx.routes;

import io.vertx.core.Handler;
import io.vertx.core.buffer.Buffer;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.RoutingContext;
import rb.domain.Domain;
import rb.domain.Json;

/**
 * etag: one handler per route, built by the factory below.
 *
 * Vert.x ships no conditional handling, so the digest is the shared one and /__meta says
 * so. Nor does it have an after-hook that can change a response: addHeadersEndHandler sees
 * the headers and not the body, and once end() has been called there is nothing left to
 * intercept. A handler is Vert.x Web's unit of composition, so the conditional is a handler
 * and the route is where it is attached, which is the closest thing this framework has to
 * the filter the servlet stacks scope by url pattern.
 *
 * Shallow, which is the point: the body is serialized and hashed before anything is
 * compared, so the 304 saves the write and nothing else.
 */
public final class Etag {
  private Etag() {}

  // rb:wiring etag.*
  private static Handler<RoutingContext> revalidating(String size) {
    return ctx -> {
      byte[] raw = Json.bytes(Domain.payload(size));
      String etag = Domain.contentETag(raw);
      ctx.response()
         .putHeader("etag", etag)
         .putHeader("cache-control", Domain.CACHEABLE)
         .putHeader("x-rb-serial", Domain.nextSerial());
      if (etag.equals(ctx.request().getHeader("if-none-match"))) {
        ctx.response().setStatusCode(304).end();
        return;
      }
      ctx.response()
         .setStatusCode(200)
         .putHeader("content-type", "application/json")
         .putHeader("content-length", Integer.toString(raw.length))
         .end(Buffer.buffer(raw));
    };
  }

  public static void register(Router router) {
    // rb:handler etag.*
    for (String size : new String[] {"small", "large"}) {
      router.get("/etag/" + size).handler(revalidating(size));
    }
  }
}
