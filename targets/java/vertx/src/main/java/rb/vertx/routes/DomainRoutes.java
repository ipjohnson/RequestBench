package rb.vertx.routes;

import io.vertx.ext.web.Router;
import io.vertx.ext.web.handler.BodyHandler;
import io.vertx.ext.web.RoutingContext;
import io.vertx.ext.web.validation.RequestParameters;
import io.vertx.ext.web.validation.ValidationHandler;
import rb.vertx.Validation;
import rb.domain.Domain;
import rb.domain.Model.ValidatedOrder;
import rb.domain.Model.ValidatedOrderWithId;
import rb.vertx.Reply;

/** domain: application-shaped handler work and the write methods. */
public final class DomainRoutes {
  private DomainRoutes() {}

  private static io.vertx.core.json.JsonObject validatedBody(RoutingContext ctx) {
    RequestParameters params = ctx.get(ValidationHandler.REQUEST_CONTEXT_KEY);
    return params.body().getJsonObject();
  }

  public static void register(Router router) {
    router.get("/domain/orders")
          .handler(Query.filterHandler())
          .handler(ctx -> Reply.guarded(ctx, () -> Reply.json(ctx, 200,
              Domain.domainFilter(Query.qint(ctx, "page", 0), Query.qint(ctx, "size", 25),
                                  Query.qstr(ctx, "status")))))
          .failureHandler(Reply::failure);

    // The same ValidationHandler as the body family: a write validates the same way, and
    // through the same facility.
    ValidationHandler order = Validation.orderHandler(router);

    router.post("/domain/orders").handler(BodyHandler.create()).handler(order).handler(ctx ->
        Reply.guarded(ctx, () -> {
          ValidatedOrder v = Validation.order(validatedBody(ctx));
          ctx.response().putHeader("location", Domain.createdLocation());
          Reply.json(ctx, 201, v);
        })).failureHandler(Reply::failure);

    router.get("/domain/orders/:oid").handler(ctx ->
        Reply.guarded(ctx, () -> Reply.json(ctx, 200,
            Domain.getOrder(ctx.pathParam("oid")))));

    router.put("/domain/orders/:oid").handler(BodyHandler.create()).handler(order)
          .handler(ctx ->
        Reply.guarded(ctx, () -> {
          int id = Domain.getOrder(ctx.pathParam("oid")).id();
          ValidatedOrder v = Validation.order(validatedBody(ctx));
          Reply.json(ctx, 200, new ValidatedOrderWithId(id, v.customerId(), v.status(),
                                                        v.lines(), v.totalCents()));
        })).failureHandler(Reply::failure);

    router.get("/domain/customers/:cid/summary").handler(ctx ->
        Reply.guarded(ctx, () -> Reply.json(ctx, 200,
            Domain.domainJoin(ctx.pathParam("cid")))));

    router.get("/domain/regions/:region/report").handler(ctx ->
        Reply.guarded(ctx, () -> Reply.json(ctx, 200,
            Domain.domainAggregate(ctx.pathParam("region")))));

    router.patch("/domain/customers/:cid").handler(BodyHandler.create()).handler(ctx ->
        Reply.guarded(ctx, () -> Reply.json(ctx, 200,
            Domain.patchCustomer(ctx.pathParam("cid"), Reply.body(ctx)))));

    router.delete("/domain/orders/:oid/lines/:lid").handler(ctx ->
        Reply.guarded(ctx, () -> {
          Domain.getOrderLine(ctx.pathParam("oid"), ctx.pathParam("lid"));
          Reply.noBody(ctx, 204);
        }));
  }
}
