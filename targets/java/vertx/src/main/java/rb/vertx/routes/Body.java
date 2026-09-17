package rb.vertx.routes;

import io.vertx.ext.web.Router;
import io.vertx.ext.web.handler.BodyHandler;
import io.vertx.ext.web.validation.RequestParameters;
import io.vertx.ext.web.validation.ValidationHandler;
import rb.domain.Domain;
import rb.vertx.Reply;
import rb.vertx.Validation;

/**
 * body: the parser and the validator, with size crossed against validation.
 *
 * BodyHandler is attached to these five routes rather than to the router. On the router it
 * would buffer a body on all forty-five endpoints, including the thirty-eight that never
 * send one.
 *
 * bind parses and binds without validating, so validate minus bind is the validator alone
 * rather than the validator plus the parse. Validating is a ValidationHandler mounted ahead
 * of the business handler, so the handler only ever sees a body that passed.
 */
public final class Body {
  private Body() {}

  public static void register(Router router) {
    router.post("/body/bind/small").handler(BodyHandler.create()).handler(ctx ->
        Reply.guarded(ctx, () -> Reply.json(ctx, 200, Domain.bindEcho(Reply.body(ctx)))));

    router.post("/body/bind/medium").handler(BodyHandler.create()).handler(ctx ->
        Reply.guarded(ctx, () -> Reply.json(ctx, 200, Domain.bindEcho(Reply.body(ctx)))));

    ValidationHandler order = Validation.orderHandler(router);

    router.post("/body/validate/small").handler(BodyHandler.create()).handler(order)
          .handler(Body::validated).failureHandler(Reply::failure);

    router.post("/body/validate/medium").handler(BodyHandler.create()).handler(order)
          .handler(Body::validated).failureHandler(Reply::failure);

    // The handler fails the context on the first thing that did not fit the schema, and
    // offers no collect-all mode, so this row answers what Vert.x answers.
    router.post("/body/validate/first-error").handler(BodyHandler.create()).handler(order)
          .handler(Body::validated).failureHandler(Reply::failure);
  }

  private static void validated(io.vertx.ext.web.RoutingContext ctx) {
    RequestParameters params = ctx.get(ValidationHandler.REQUEST_CONTEXT_KEY);
    Reply.guarded(ctx,
        () -> Reply.json(ctx, 200, Validation.order(params.body().getJsonObject())));
  }
}
