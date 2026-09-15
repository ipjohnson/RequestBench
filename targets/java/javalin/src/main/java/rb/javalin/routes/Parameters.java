package rb.javalin.routes;

import io.javalin.config.JavalinConfig;
import rb.domain.Domain;

/** parameters: router captures with segment depth held constant. */
public final class Parameters {
  private Parameters() {}

  public static void register(JavalinConfig cfg) {
    cfg.routes.get("/parameters/static/segment/literal",
                   ctx -> ctx.json(Domain.payload("small")));

    cfg.routes.get("/parameters/{one}", ctx -> ctx.json(Domain.payload("small")));

    cfg.routes.get("/parameters/{one}/with-second/{two}",
                   ctx -> ctx.json(Domain.payload("small")));
  }
}
