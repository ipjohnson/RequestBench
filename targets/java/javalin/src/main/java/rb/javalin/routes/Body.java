package rb.javalin.routes;

import io.javalin.config.JavalinConfig;
import io.javalin.http.Context;
import rb.domain.Domain;
import rb.javalin.OrderIn;
import rb.javalin.Support;

/**
 * body: the parser and the validator, with size crossed against validation.
 *
 * bind parses and binds without validating, so validate minus bind is the validator alone
 * rather than the validator plus the parse. Validating is ctx.bodyValidator, Javalin's own:
 * it deserializes into the class, runs the checks chained onto it, and raises
 * ValidationException itself. No handler calls a validator.
 */
public final class Body {
  private Body() {}

  public static void register(JavalinConfig cfg) {
    cfg.routes.post("/body/bind/small",
                    ctx -> ctx.json(Domain.bindEcho(Support.body(ctx))));

    cfg.routes.post("/body/bind/medium",
                    ctx -> ctx.json(Domain.bindEcho(Support.body(ctx))));

    cfg.routes.post("/body/validate/small", ctx -> ctx.json(validated(ctx).order()));

    cfg.routes.post("/body/validate/medium", ctx -> ctx.json(validated(ctx).order()));

    // ctx.bodyValidator collects every check that failed; it has no mode that stops at the
    // first. So this row answers what Javalin answers, and the gap to body.rejected_all is
    // what Javalin costs rather than the same walk written twice.
    cfg.routes.post("/body/validate/first-error", ctx -> ctx.json(validated(ctx).order()));
  }

  /** Javalin's validator, with this target's checks chained onto it. */
  public static OrderIn validated(Context ctx) {
    return ctx.bodyValidator(OrderIn.class)
              .check(OrderIn::hasCustomerId, "customer_id is required")
              .check(OrderIn::hasStatus, "status is required")
              .check(OrderIn::hasLines, "lines must have at least one entry")
              .check(OrderIn::linesAreComplete,
                     "every line needs a product_id and a qty of 1 or more")
              .get();
  }
}
