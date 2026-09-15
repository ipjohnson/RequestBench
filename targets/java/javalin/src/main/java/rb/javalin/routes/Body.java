package rb.javalin.routes;

import io.javalin.config.JavalinConfig;
import rb.domain.Domain;
import rb.javalin.Support;

/**
 * body: the parser and the validator, with size crossed against validation.
 *
 * bind parses and binds without validating, so validate minus bind is the validator alone
 * rather than the validator plus the parse.
 */
public final class Body {
  private Body() {}

  public static void register(JavalinConfig cfg) {
    cfg.routes.post("/body/bind/small",
                    ctx -> ctx.json(Domain.bindEcho(Support.body(ctx))));

    cfg.routes.post("/body/bind/medium",
                    ctx -> ctx.json(Domain.bindEcho(Support.body(ctx))));

    cfg.routes.post("/body/validate/small",
                    ctx -> ctx.json(Domain.validateOrder(Support.body(ctx))));

    cfg.routes.post("/body/validate/medium",
                    ctx -> ctx.json(Domain.validateOrder(Support.body(ctx))));

    cfg.routes.post("/body/validate/first-error",
                    ctx -> ctx.json(Domain.validateOrderFirst(Support.body(ctx))));
  }
}
