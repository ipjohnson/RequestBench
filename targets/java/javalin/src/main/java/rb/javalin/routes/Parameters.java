package rb.javalin.routes;

import io.javalin.config.JavalinConfig;
import rb.domain.Domain;

/**
 * parameters: router captures with segment depth held constant.
 *
 * Javalin's own binding: pathParamAsClass names the capture and the class it wants, and
 * returns a Validator that has already run Javalin's converter for that type.
 */
public final class Parameters {
  private Parameters() {}

  record One(int one) {}

  record Two(int one, int two) {}

  public static void register(JavalinConfig cfg) {
    // Registered first. Javalin answers with the first route that matches, and
    // {one}/segment/literal matches this path too.
    cfg.routes.get("/parameters/static/segment/literal",
                   ctx -> ctx.json(Domain.payload("small")));

    cfg.routes.get("/parameters/{one}/segment/literal", ctx -> ctx.json(Domain.withEcho("small",
        new One(ctx.pathParamAsClass("one", Integer.class).get()))));

    cfg.routes.get("/parameters/{one}/with-second/{two}", ctx -> ctx.json(Domain.withEcho("small",
        new Two(ctx.pathParamAsClass("one", Integer.class).get(),
                ctx.pathParamAsClass("two", Integer.class).get()))));
  }
}
