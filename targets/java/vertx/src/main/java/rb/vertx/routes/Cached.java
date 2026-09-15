package rb.vertx.routes;

import io.vertx.ext.web.Router;
import rb.domain.Domain;
import rb.vertx.Reply;

/**
 * cached: validator headers and the conditional request.
 *
 * The ETag is pinned in the fixture, so this measures emitting the header and comparing it
 * rather than hashing the body. The size is closed over rather than read back out of the
 * path, and the comparison requires a non-empty header: matching a missing if-none-match
 * against an empty ETag answers 304 to a client that never asked a conditional question.
 */
public final class Cached {
  private Cached() {}

  public static void register(Router router) {
    // rb:snippet cached.small cached.medium cached.large cached.revalidate
    for (String size : new String[] {"small", "medium", "large"}) {
      String etag = Domain.etagOf(size);
      router.get("/cached/" + size).handler(ctx -> {
        ctx.response()
           .putHeader("etag", etag)
           .putHeader("cache-control", Domain.CACHEABLE)
           .putHeader("x-rb-serial", Domain.nextSerial());
        String inm = ctx.request().getHeader("if-none-match");
        if (inm != null && inm.equals(etag)) {
          Reply.noBody(ctx, 304);
          return;
        }
        Reply.json(ctx, 200, Domain.payload(size));
      });
    }
  }
}
