package rb.javalin.routes;

import io.javalin.config.JavalinConfig;
import rb.domain.Domain;
import rb.domain.Model.ValidatedOrder;
import rb.domain.Model.ValidatedOrderWithId;
import rb.javalin.Support;

/** domain: application-shaped handler work and the write methods. */
public final class DomainRoutes {
  private DomainRoutes() {}

  public static void register(JavalinConfig cfg) {
    cfg.routes.get("/domain/orders",
                   ctx -> ctx.json(Domain.domainFilter(Support.query(ctx))));

    cfg.routes.post("/domain/orders", ctx -> {
      ValidatedOrder v = Domain.validateOrder(Support.body(ctx));
      ctx.header("location", Domain.createdLocation()).status(201).json(v);
    });

    cfg.routes.get("/domain/orders/{oid}",
                   ctx -> ctx.json(Domain.getOrder(ctx.pathParam("oid"))));

    cfg.routes.put("/domain/orders/{oid}", ctx -> {
      int id = Domain.getOrder(ctx.pathParam("oid")).id();
      ValidatedOrder v = Domain.validateOrder(Support.body(ctx));
      ctx.json(new ValidatedOrderWithId(id, v.customerId(), v.status(), v.lines(),
                                        v.totalCents()));
    });

    cfg.routes.get("/domain/customers/{cid}/summary",
                   ctx -> ctx.json(Domain.domainJoin(ctx.pathParam("cid"))));

    cfg.routes.get("/domain/regions/{region}/report",
                   ctx -> ctx.json(Domain.domainAggregate(ctx.pathParam("region"))));

    cfg.routes.patch("/domain/customers/{cid}",
                     ctx -> ctx.json(Domain.patchCustomer(ctx.pathParam("cid"),
                                                          Support.body(ctx))));

    cfg.routes.delete("/domain/orders/{oid}/lines/{lid}", ctx -> {
      Domain.getOrderLine(ctx.pathParam("oid"), ctx.pathParam("lid"));
      Support.noBody(ctx, 204);
    });
  }
}
