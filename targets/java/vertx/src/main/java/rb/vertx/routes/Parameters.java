package rb.vertx.routes;

import io.vertx.ext.web.Router;
import io.vertx.ext.web.RoutingContext;
import io.vertx.ext.web.validation.RequestParameters;
import io.vertx.ext.web.validation.ValidationHandler;
import io.vertx.ext.web.validation.builder.ValidationHandlerBuilder;
import rb.domain.Domain;
import rb.vertx.Reply;
import rb.vertx.Validation;

import static io.vertx.ext.web.validation.builder.Parameters.param;
import static io.vertx.json.schema.common.dsl.Schemas.intSchema;

/**
 * parameters: router captures with segment depth held constant.
 *
 * The captures are bound with the facility the query family binds with: a ValidationHandler
 * declares each one with an integer schema, so Vert.x parses and types it before the business
 * handler runs, and the handler reads the typed value back out of RequestParameters.
 */
public final class Parameters {
  private Parameters() {}

  record One(int one) {}

  record Two(int one, int two) {}

  // rb:wiring parameters.*
  private static ValidationHandler captures(String... names) {
    ValidationHandlerBuilder b = ValidationHandlerBuilder.create(Validation.repository());
    for (String name : names) {
      b = b.pathParameter(param(name, intSchema()));
    }
    return b.build();
  }

  // rb:wiring parameters.*
  private static int capture(RoutingContext ctx, String name) {
    RequestParameters params = ctx.get(ValidationHandler.REQUEST_CONTEXT_KEY);
    return params.pathParameter(name).getInteger();
  }

  public static void register(Router router) {
    // Registered first. Vert.x tries routes in the order they were added, and
    // :one/segment/literal matches this path too.
    router.get("/parameters/static/segment/literal")
          .handler(ctx -> Reply.json(ctx, 200, Domain.payload("small")));

    router.get("/parameters/:one/segment/literal")
          .handler(captures("one"))
          .handler(ctx -> Reply.json(ctx, 200,
              Domain.withEcho("small", new One(capture(ctx, "one")))))
          .failureHandler(Reply::failure);

    router.get("/parameters/:one/with-second/:two")
          .handler(captures("one", "two"))
          .handler(ctx -> Reply.json(ctx, 200,
              Domain.withEcho("small", new Two(capture(ctx, "one"), capture(ctx, "two")))))
          .failureHandler(Reply::failure);
  }
}
