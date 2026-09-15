package rb.javalin.routes;

import io.javalin.config.JavalinConfig;
import rb.domain.Domain;
import rb.javalin.Support;

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

  public static void register(JavalinConfig cfg) {
    // rb:snippet cached.small cached.medium cached.large cached.revalidate
    for (String size : new String[] {"small", "medium", "large"}) {
      String etag = Domain.etagOf(size);
      cfg.routes.get("/cached/" + size, ctx -> {
        ctx.header("etag", etag);
        ctx.header("cache-control", Domain.CACHEABLE);
        ctx.header("x-rb-serial", Domain.nextSerial());
        String inm = ctx.header("if-none-match");
        if (inm != null && inm.equals(etag)) {
          Support.noBody(ctx, 304);
          return;
        }
        ctx.json(Domain.payload(size));
      });
    }
  }
}
