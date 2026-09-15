package rb.vertx.routes;

import io.vertx.ext.web.Router;
import io.vertx.ext.web.handler.BodyHandler;
import rb.domain.Domain;
import rb.vertx.Reply;

/**
 * body: the parser and the validator, with size crossed against validation.
 *
 * BodyHandler is attached to these five routes rather than to the router. On the router it
 * would buffer a body on all forty-five endpoints, including the thirty-eight that never
 * send one.
 *
 * bind parses and binds without validating, so validate minus bind is the validator alone
 * rather than the validator plus the parse.
 */
public final class Body {
  private Body() {}

  public static void register(Router router) {
    router.post("/body/bind/small").handler(BodyHandler.create()).handler(ctx ->
        Reply.guarded(ctx, () -> Reply.json(ctx, 200, Domain.bindEcho(Reply.body(ctx)))));

    router.post("/body/bind/medium").handler(BodyHandler.create()).handler(ctx ->
        Reply.guarded(ctx, () -> Reply.json(ctx, 200, Domain.bindEcho(Reply.body(ctx)))));

    router.post("/body/validate/small").handler(BodyHandler.create()).handler(ctx ->
        Reply.guarded(ctx, () -> Reply.json(ctx, 200, Domain.validateOrder(Reply.body(ctx)))));

    router.post("/body/validate/medium").handler(BodyHandler.create()).handler(ctx ->
        Reply.guarded(ctx, () -> Reply.json(ctx, 200, Domain.validateOrder(Reply.body(ctx)))));

    router.post("/body/validate/first-error").handler(BodyHandler.create()).handler(ctx ->
        Reply.guarded(ctx,
            () -> Reply.json(ctx, 200, Domain.validateOrderFirst(Reply.body(ctx)))));
  }
}
