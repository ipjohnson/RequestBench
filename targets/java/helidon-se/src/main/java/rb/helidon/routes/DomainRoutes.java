package rb.helidon.routes;

import io.helidon.webserver.http.HttpRouting;
import rb.domain.Domain;
import rb.domain.Model.ValidatedOrder;
import rb.domain.Model.ValidatedOrderWithId;
import rb.helidon.Reply;
import rb.helidon.Validation;

/** domain: application-shaped handler work and the write methods. */
public final class DomainRoutes {
  private DomainRoutes() {}

  public static void register(HttpRouting.Builder r) {
    r.get("/domain/orders", (req, res) -> res.send(
        Domain.domainFilter(Query.qint(req, "page", 0), Query.qint(req, "size", 25),
                            Query.qstr(req, "status"))));

    r.post("/domain/orders", (req, res) -> {
      ValidatedOrder v = Validation.validated(Reply.body(req), false);
      res.header("location", Domain.createdLocation());
      res.status(201).send(v);
    });

    r.get("/domain/orders/{oid}",
          (req, res) -> res.send(Domain.getOrder(Reply.param(req, "oid"))));

    r.put("/domain/orders/{oid}", (req, res) -> {
      int id = Domain.getOrder(Reply.param(req, "oid")).id();
      ValidatedOrder v = Validation.validated(Reply.body(req), false);
      res.send(new ValidatedOrderWithId(id, v.customerId(), v.status(), v.lines(),
                                        v.totalCents()));
    });

    r.get("/domain/customers/{cid}/summary",
          (req, res) -> res.send(Domain.domainJoin(Reply.param(req, "cid"))));

    r.get("/domain/regions/{region}/report",
          (req, res) -> res.send(Domain.domainAggregate(Reply.param(req, "region"))));

    r.patch("/domain/customers/{cid}",
            (req, res) -> res.send(Domain.patchCustomer(Reply.param(req, "cid"),
                                                        Reply.body(req))));

    r.delete("/domain/orders/{oid}/lines/{lid}", (req, res) -> {
      Domain.getOrderLine(Reply.param(req, "oid"), Reply.param(req, "lid"));
      Reply.noBody(res, 204);
    });
  }
}
