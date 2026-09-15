package rb.javalin.routes;

import io.javalin.config.JavalinConfig;
import rb.domain.Domain;

/**
 * headers: eager against lazy construction of the request header map.
 *
 * The handler reads no header at all, so headers.many minus headers.few is the cost of
 * materialising 27 nobody asked for.
 */
public final class Headers {
  private Headers() {}

  public static void register(JavalinConfig cfg) {
    cfg.routes.get("/headers", ctx -> ctx.json(Domain.payload("small")));
  }
}
