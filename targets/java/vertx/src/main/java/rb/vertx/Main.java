package rb.vertx;

import com.fasterxml.jackson.databind.JsonNode;
import io.vertx.core.Vertx;
import io.vertx.core.http.HttpMethod;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.RoutingContext;
import io.vertx.ext.web.handler.BodyHandler;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import rb.domain.Domain;
import rb.domain.Errors;
import rb.domain.Json;
import rb.domain.Model.ValidatedOrder;
import rb.domain.Model.ValidatedOrderWithId;
import rb.hosts.Hosts;

/** RequestBench target: Vert.x Web. Framework wiring only; behaviour from rb-shared. */
public final class Main {

  public static void main(String[] args) throws Exception {
    Domain.load(Hosts.fixture());
    Vertx vertx = Vertx.vertx();
    Router router = Router.router(vertx);
    routes(router);
    vertx.createHttpServer()
         .requestHandler(router)
         .listen(Hosts.port())
         .toCompletionStage().toCompletableFuture().get();
    System.out.println("container/vertx listening on " + Hosts.port());
  }

  /**
   * Vert.x exposes query parameters as a MultiMap, so they are flattened here into the
   * Map the domain takes. Nothing about that is Vert.x-specific behaviour; it is the one
   * shape difference between this framework and the others.
   */
  private static Map<String, List<String>> q(RoutingContext ctx) {
    Map<String, List<String>> out = new LinkedHashMap<>();
    for (Map.Entry<String, String> e : ctx.queryParams()) {
      out.computeIfAbsent(e.getKey(), k -> new ArrayList<>(1)).add(e.getValue());
    }
    return out;
  }

  private static JsonNode body(RoutingContext ctx) {
    try {
      return Json.MAPPER.readTree(ctx.body().asString());
    } catch (Exception e) {
      throw Errors.Validation.json();
    }
  }

  private static void fail(RoutingContext ctx, Throwable t) {
    if (t instanceof Errors.NotFound) {
      ctx.response().setStatusCode(404).putHeader("content-type", "application/json")
         .end(new String(Json.bytes(Map.of("error", "not_found"))));
    } else if (t instanceof Errors.Validation v) {
      Map<String, Object> b = new LinkedHashMap<>(2);
      b.put("error", "validation_failed");
      b.put("errors", v.errors());
      ctx.response().setStatusCode(422).putHeader("content-type", "application/json")
         .end(new String(Json.bytes(b)));
    } else {
      Map<String, String> b = new LinkedHashMap<>(2);
      b.put("error", "internal");
      b.put("message", t.getMessage() == null ? "internal" : t.getMessage());
      ctx.response().setStatusCode(500).putHeader("content-type", "application/json")
         .end(new String(Json.bytes(b)));
    }
  }

  /** Every handler runs through here, so one place maps a domain outcome to a status. */
  private static void get(Router r, String path, Function<RoutingContext, Object> fn) {
    r.route(HttpMethod.GET, path).handler(ctx -> {
      try {
        ctx.json(fn.apply(ctx));
      } catch (RuntimeException e) {
        fail(ctx, e);
      }
    });
  }

  private static void body(Router r, HttpMethod method, String path, int status,
                           Function<RoutingContext, Object> fn) {
    r.route(method, path).handler(BodyHandler.create()).handler(ctx -> {
      try {
        ctx.response().setStatusCode(status);
        ctx.json(fn.apply(ctx));
      } catch (RuntimeException e) {
        fail(ctx, e);
      }
    });
  }

  static void routes(Router r) {
    r.route(HttpMethod.GET, "/plaintext").handler(ctx ->
        ctx.response().putHeader("content-type", "text/plain").end("Hello, World!"));
    r.route(HttpMethod.GET, "/health").handler(ctx ->
        ctx.response().putHeader("content-type", "text/plain").end("ok"));
    get(r, "/json/small", ctx -> Domain.jsonSmall());
    get(r, "/products", ctx -> Domain.listProducts(q(ctx)));
    get(r, "/customers", ctx -> Domain.listCustomers(q(ctx)));
    get(r, "/orders", ctx -> Domain.listOrders(q(ctx)));
    get(r, "/search", ctx -> Domain.search(q(ctx)));
    get(r, "/dashboard", ctx -> Domain.dashboard());
    get(r, "/__meta", ctx -> Hosts.meta("vertx", Hosts.version("vertx")));
    r.route(HttpMethod.GET, "/boom").handler(ctx -> fail(ctx, new Errors.Boom()));
    r.route(HttpMethod.GET, "/forbidden").handler(ctx -> {
      ctx.response().setStatusCode(403);
      ctx.json(Map.of("error", "forbidden"));
    });

    get(r, "/products/:pid", ctx -> Domain.getProduct(ctx.pathParam("pid")));
    get(r, "/customers/:cid", ctx -> Domain.getCustomer(ctx.pathParam("cid")));
    get(r, "/orders/:oid", ctx -> Domain.getOrder(ctx.pathParam("oid")));
    get(r, "/products/:pid/reviews", ctx -> Domain.getProductReviews(ctx.pathParam("pid")));
    get(r, "/products/:pid/related", ctx -> Domain.relatedProducts(ctx.pathParam("pid")));
    get(r, "/customers/:cid/orders", ctx -> Domain.getCustomerOrders(ctx.pathParam("cid")));
    get(r, "/customers/:cid/summary", ctx -> Domain.customerSummary(ctx.pathParam("cid")));
    get(r, "/orders/:oid/lines", ctx -> Domain.getOrderLines(ctx.pathParam("oid")));
    get(r, "/orders/:oid/full", ctx -> Domain.orderFull(ctx.pathParam("oid")));
    get(r, "/regions/:r/customers", ctx -> Domain.getRegionCustomers(ctx.pathParam("r")));
    get(r, "/regions/:r/report", ctx -> Domain.regionReport(ctx.pathParam("r")));
    get(r, "/customers/:cid/orders/:oid",
        ctx -> Domain.getCustomerOrder(ctx.pathParam("cid"), ctx.pathParam("oid")));
    get(r, "/orders/:oid/lines/:lid",
        ctx -> Domain.getOrderLine(ctx.pathParam("oid"), ctx.pathParam("lid")));
    get(r, "/regions/:r/customers/:cid/orders/:oid/lines/:lid",
        ctx -> Domain.getOrderLine(ctx.pathParam("oid"), ctx.pathParam("lid")));

    body(r, HttpMethod.POST, "/orders/validate", 200, ctx -> Domain.validateOrder(body(ctx)));
    body(r, HttpMethod.POST, "/customers/validate", 200,
         ctx -> Domain.validateCustomer(body(ctx)));
    body(r, HttpMethod.POST, "/products/validate", 200,
         ctx -> Domain.validateProduct(body(ctx)));
    body(r, HttpMethod.POST, "/echo", 200, ctx -> Domain.echo(body(ctx)));
    body(r, HttpMethod.POST, "/orders", 201, ctx -> {
      ValidatedOrder v = Domain.validateOrder(body(ctx));
      ctx.response().putHeader("location", "/orders/" + Domain.nextOrderId);
      return v;
    });
    body(r, HttpMethod.POST, "/orders/:oid/lines", 201, ctx -> {
      int lines = Domain.getOrder(ctx.pathParam("oid")).lines().size();
      var v = Domain.validateLine(body(ctx));
      ctx.response().putHeader("location",
          "/orders/" + ctx.pathParam("oid") + "/lines/" + (lines + 1));
      return v;
    });
    body(r, HttpMethod.PUT, "/orders/:oid", 200, ctx -> {
      int id = Domain.getOrder(ctx.pathParam("oid")).id();
      ValidatedOrder v = Domain.validateOrder(body(ctx));
      return new ValidatedOrderWithId(id, v.customerId(), v.status(), v.lines(),
                                      v.totalCents());
    });
    body(r, HttpMethod.PATCH, "/customers/:cid", 200,
         ctx -> Domain.patchCustomer(ctx.pathParam("cid"), body(ctx)));
    r.route(HttpMethod.DELETE, "/orders/:oid/lines/:lid").handler(ctx -> {
      try {
        Domain.getOrderLine(ctx.pathParam("oid"), ctx.pathParam("lid"));
        ctx.response().setStatusCode(204).end();
      } catch (RuntimeException e) {
        fail(ctx, e);
      }
    });

    // Unmatched paths reach no handler, so the 404 body comes from the catch-all rather
    // than from a domain lookup.
    r.route().handler(ctx -> {
      ctx.response().setStatusCode(404);
      ctx.json(Map.of("error", "not_found"));
    });
  }

  private Main() {}
}
