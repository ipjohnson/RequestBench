package rb.helidon;

import io.helidon.common.parameters.Parameters;
import io.helidon.webserver.WebServer;
import io.helidon.webserver.http.HttpRouting;
import io.helidon.webserver.http.ServerRequest;
import io.helidon.webserver.http.ServerResponse;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import rb.domain.Domain;
import rb.domain.Errors;
import rb.domain.Model.ValidatedOrder;
import rb.domain.Model.ValidatedOrderWithId;
import rb.hosts.Hosts;

/** RequestBench target: Helidon SE. Framework wiring only; behaviour from rb-shared. */
public final class Main {

  public static void main(String[] args) throws Exception {
    Domain.load(Hosts.fixture());
    WebServer.builder()
             .port(Hosts.port())
             .routing(Main::routes)
             .build()
             .start();
    System.out.println("container/helidon-se listening on " + Hosts.port());
  }

  private static Map<String, List<String>> q(ServerRequest req) {
    Parameters p = req.query();
    Map<String, List<String>> out = new LinkedHashMap<>();
    for (String name : p.names()) {
      out.put(name, new ArrayList<>(p.all(name)));
    }
    return out;
  }

  private static String param(ServerRequest req, String name) {
    return req.path().pathParameters().first(name).orElse("");
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> body(ServerRequest req) {
    try {
      return req.content().as(Map.class);
    } catch (RuntimeException e) {
      throw Errors.Validation.json();
    }
  }

  private static void get(HttpRouting.Builder r, String path,
                          Function<ServerRequest, Object> fn) {
    r.get(path, (req, res) -> res.send(fn.apply(req)));
  }

  private static void body(HttpRouting.Builder r, String method, String path, int status,
                           java.util.function.BiFunction<ServerRequest, ServerResponse, Object> fn) {
    io.helidon.webserver.http.Handler h = (req, res) -> {
      Object v = fn.apply(req, res);
      res.status(status).send(v);
    };
    switch (method) {
      case "POST" -> r.post(path, h);
      case "PUT" -> r.put(path, h);
      case "PATCH" -> r.patch(path, h);
      default -> throw new IllegalArgumentException(method);
    }
  }

  static void routes(HttpRouting.Builder r) {
    r.error(Errors.NotFound.class, (req, res, ex) ->
        res.status(404).send(Map.of("error", "not_found")));
    r.error(Errors.Validation.class, (req, res, ex) -> {
      Map<String, Object> b = new LinkedHashMap<>(2);
      b.put("error", "validation_failed");
      b.put("errors", ex.errors());
      res.status(422).send(b);
    });
    r.error(Errors.Boom.class, (req, res, ex) -> {
      Map<String, String> b = new LinkedHashMap<>(2);
      b.put("error", "internal");
      b.put("message", ex.getMessage() == null ? "internal" : ex.getMessage());
      res.status(500).send(b);
    });

    r.get("/plaintext", (req, res) -> res.header("content-type", "text/plain")
                                         .send("Hello, World!"));
    r.get("/health", (req, res) -> res.header("content-type", "text/plain").send("ok"));
    get(r, "/json/small", req -> Domain.jsonSmall());
    get(r, "/products", req -> Domain.listProducts(q(req)));
    get(r, "/customers", req -> Domain.listCustomers(q(req)));
    get(r, "/orders", req -> Domain.listOrders(q(req)));
    get(r, "/search", req -> Domain.search(q(req)));
    get(r, "/dashboard", req -> Domain.dashboard());
    get(r, "/__meta", req -> Hosts.meta("helidon-se", Hosts.version("helidon")));
    r.get("/boom", (req, res) -> { throw new Errors.Boom(); });
    r.get("/forbidden", (req, res) -> res.status(403).send(Map.of("error", "forbidden")));

    get(r, "/products/{pid}", req -> Domain.getProduct(param(req, "pid")));
    get(r, "/customers/{cid}", req -> Domain.getCustomer(param(req, "cid")));
    get(r, "/orders/{oid}", req -> Domain.getOrder(param(req, "oid")));
    get(r, "/products/{pid}/reviews", req -> Domain.getProductReviews(param(req, "pid")));
    get(r, "/products/{pid}/related", req -> Domain.relatedProducts(param(req, "pid")));
    get(r, "/customers/{cid}/orders", req -> Domain.getCustomerOrders(param(req, "cid")));
    get(r, "/customers/{cid}/summary", req -> Domain.customerSummary(param(req, "cid")));
    get(r, "/orders/{oid}/lines", req -> Domain.getOrderLines(param(req, "oid")));
    get(r, "/orders/{oid}/full", req -> Domain.orderFull(param(req, "oid")));
    get(r, "/regions/{r}/customers", req -> Domain.getRegionCustomers(param(req, "r")));
    get(r, "/regions/{r}/report", req -> Domain.regionReport(param(req, "r")));
    get(r, "/customers/{cid}/orders/{oid}",
        req -> Domain.getCustomerOrder(param(req, "cid"), param(req, "oid")));
    get(r, "/orders/{oid}/lines/{lid}",
        req -> Domain.getOrderLine(param(req, "oid"), param(req, "lid")));
    get(r, "/regions/{r}/customers/{cid}/orders/{oid}/lines/{lid}",
        req -> Domain.getOrderLine(param(req, "oid"), param(req, "lid")));

    body(r, "POST", "/orders/validate", 200, (req, res) -> Domain.validateOrder(body(req)));
    body(r, "POST", "/customers/validate", 200,
         (req, res) -> Domain.validateCustomer(body(req)));
    body(r, "POST", "/products/validate", 200,
         (req, res) -> Domain.validateProduct(body(req)));
    body(r, "POST", "/echo", 200, (req, res) -> Domain.echo(body(req)));
    body(r, "POST", "/orders", 201, (req, res) -> {
      ValidatedOrder v = Domain.validateOrder(body(req));
      res.header("location", "/orders/" + Domain.nextOrderId);
      return v;
    });
    body(r, "POST", "/orders/{oid}/lines", 201, (req, res) -> {
      int lines = Domain.getOrder(param(req, "oid")).lines().size();
      var v = Domain.validateLine(body(req));
      res.header("location", "/orders/" + param(req, "oid") + "/lines/" + (lines + 1));
      return v;
    });
    body(r, "PUT", "/orders/{oid}", 200, (req, res) -> {
      int id = Domain.getOrder(param(req, "oid")).id();
      ValidatedOrder v = Domain.validateOrder(body(req));
      return new ValidatedOrderWithId(id, v.customerId(), v.status(), v.lines(),
                                      v.totalCents());
    });
    body(r, "PATCH", "/customers/{cid}", 200,
         (req, res) -> Domain.patchCustomer(param(req, "cid"), body(req)));
    r.delete("/orders/{oid}/lines/{lid}", (req, res) -> {
      Domain.getOrderLine(param(req, "oid"), param(req, "lid"));
      res.status(204).send();
    });

    // Registered last, so it only sees what nothing above matched.
    r.any((req, res) -> res.status(404).send(Map.of("error", "not_found")));
  }

  private Main() {}
}
