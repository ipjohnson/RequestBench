package rb.javalin.routes;

import io.javalin.config.JavalinConfig;
import java.nio.charset.StandardCharsets;
import rb.domain.Domain;
import rb.javalin.Support;

/**
 * etag: a Javalin after-handler scoped to the route pattern.
 *
 * Javalin ships no conditional handling, so the digest is the shared one and /__meta says
 * so. What is Javalin's own is the hook: after() takes the paths it applies to, so the hash
 * reaches these two routes and not the forty-six it would otherwise tax, and it runs with
 * the body the handler produced still in the context rather than on the wire.
 *
 * Shallow, which is the point: the handler runs and the body is built before anything is
 * compared, so the 304 saves the write and nothing else.
 */
public final class Etag {
  private Etag() {}

  // rb:wiring etag.*
  public static void register(JavalinConfig cfg) {
    cfg.routes.after("/etag/*", ctx -> {
      String result = ctx.result();
      byte[] raw = result == null ? new byte[0] : result.getBytes(StandardCharsets.UTF_8);
      String etag = Domain.contentETag(raw);
      ctx.header("etag", etag);
      ctx.header("cache-control", Domain.CACHEABLE);
      if (etag.equals(ctx.header("if-none-match"))) {
        ctx.result(new byte[0]);
        Support.noBody(ctx, 304);
        return;
      }
      ctx.result(raw);
    });
    // rb:handler etag.*
    for (String size : new String[] {"small", "large"}) {
      cfg.routes.get("/etag/" + size, ctx -> {
        ctx.header("x-rb-serial", Domain.nextSerial());
        ctx.json(Domain.payload(size));
      });
    }
  }
}
