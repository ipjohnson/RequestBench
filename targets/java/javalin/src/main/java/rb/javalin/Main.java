package rb.javalin;

import com.fasterxml.jackson.databind.JsonNode;
import io.javalin.Javalin;
import io.javalin.config.JavalinConfig;
import io.javalin.http.Context;
import io.javalin.json.JsonMapper;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import rb.domain.Domain;
import rb.domain.Errors;
import rb.domain.Json;
import rb.domain.Model.ValidatedOrder;
import rb.domain.Model.ValidatedOrderWithId;
import rb.hosts.Hosts;

/** RequestBench target: Javalin. Framework wiring only; behaviour from rb-shared. */
public final class Main {

  /**
   * Javalin's own Jackson integration, handed the shared ObjectMapper so the serializer
   * library is identical to every other Java target and only the integration differs.
   */
  private static final JsonMapper MAPPER = new JsonMapper() {
    @Override
    public String toJsonString(Object obj, Type type) {
      return new String(Json.bytes(obj), StandardCharsets.UTF_8);
    }

    @Override
    public InputStream toJsonStream(Object obj, Type type) {
      return new ByteArrayInputStream(Json.bytes(obj));
    }

    @Override
    public <T> T fromJsonString(String json, Type type) {
      try {
        return Json.MAPPER.readValue(json, Json.MAPPER.constructType(type));
      } catch (Exception e) {
        throw new IllegalArgumentException("json", e);
      }
    }
  };

  public static void main(String[] args) throws Exception {
    Domain.load(Hosts.fixture());
    Javalin.create(Main::configure).start(Hosts.port());
  }

  static JsonNode body(Context ctx) {
    try {
      return ctx.bodyAsClass(JsonNode.class);
    } catch (RuntimeException e) {
      throw Errors.Validation.json();
    }
  }

  static Map<String, List<String>> q(Context ctx) {
    return ctx.queryParamMap();
  }

  static void configure(JavalinConfig cfg) {
    cfg.jsonMapper(MAPPER);
    cfg.startup.showJavalinBanner = false;

    cfg.routes
       .exception(Errors.NotFound.class, (e, ctx) -> ctx.status(404)
                                                       .json(Map.of("error", "not_found")))
       .exception(Errors.Validation.class, (e, ctx) -> ctx.status(422)
           .json(Map.of("error", "validation_failed", "errors", e.errors())))
       .exception(Exception.class, (e, ctx) -> ctx.status(500)
           .json(Map.of("error", "internal",
                        "message", e.getMessage() == null ? "internal" : e.getMessage())))
       // Unmatched paths never reach a handler, so the 404 body comes from here rather
       // than from the exception above.
       .error(404, "*", ctx -> ctx.json(Map.of("error", "not_found")));

    cfg.routes
       .get("/plaintext", ctx -> ctx.contentType("text/plain").result("Hello, World!"))
       .get("/health", ctx -> ctx.contentType("text/plain").result("ok"))
       .get("/json/small", ctx -> ctx.json(Domain.jsonSmall()))
       .get("/products", ctx -> ctx.json(Domain.listProducts(q(ctx))))
       .get("/customers", ctx -> ctx.json(Domain.listCustomers(q(ctx))))
       .get("/orders", ctx -> ctx.json(Domain.listOrders(q(ctx))))
       .get("/search", ctx -> ctx.json(Domain.search(q(ctx))))
       .get("/dashboard", ctx -> ctx.json(Domain.dashboard()))
       .get("/__meta", ctx -> ctx.json(Hosts.meta("javalin", Hosts.version("javalin"))))
       .get("/boom", ctx -> { throw new Errors.Boom(); })
       .get("/forbidden", ctx -> ctx.status(403).json(Map.of("error", "forbidden")));

    cfg.routes
       .get("/products/{pid}", ctx -> ctx.json(Domain.getProduct(ctx.pathParam("pid"))))
       .get("/customers/{cid}", ctx -> ctx.json(Domain.getCustomer(ctx.pathParam("cid"))))
       .get("/orders/{oid}", ctx -> ctx.json(Domain.getOrder(ctx.pathParam("oid"))))
       .get("/products/{pid}/reviews",
            ctx -> ctx.json(Domain.getProductReviews(ctx.pathParam("pid"))))
       .get("/products/{pid}/related",
            ctx -> ctx.json(Domain.relatedProducts(ctx.pathParam("pid"))))
       .get("/customers/{cid}/orders",
            ctx -> ctx.json(Domain.getCustomerOrders(ctx.pathParam("cid"))))
       .get("/customers/{cid}/summary",
            ctx -> ctx.json(Domain.customerSummary(ctx.pathParam("cid"))))
       .get("/orders/{oid}/lines",
            ctx -> ctx.json(Domain.getOrderLines(ctx.pathParam("oid"))))
       .get("/orders/{oid}/full", ctx -> ctx.json(Domain.orderFull(ctx.pathParam("oid"))))
       .get("/regions/{r}/customers",
            ctx -> ctx.json(Domain.getRegionCustomers(ctx.pathParam("r"))))
       .get("/regions/{r}/report", ctx -> ctx.json(Domain.regionReport(ctx.pathParam("r"))))
       .get("/customers/{cid}/orders/{oid}",
            ctx -> ctx.json(Domain.getCustomerOrder(ctx.pathParam("cid"), ctx.pathParam("oid"))))
       .get("/orders/{oid}/lines/{lid}",
            ctx -> ctx.json(Domain.getOrderLine(ctx.pathParam("oid"), ctx.pathParam("lid"))))
       .get("/regions/{r}/customers/{cid}/orders/{oid}/lines/{lid}",
            ctx -> ctx.json(Domain.getOrderLine(ctx.pathParam("oid"), ctx.pathParam("lid"))));

    cfg.routes
       .post("/orders/validate", ctx -> ctx.json(Domain.validateOrder(body(ctx))))
       .post("/customers/validate", ctx -> ctx.json(Domain.validateCustomer(body(ctx))))
       .post("/products/validate", ctx -> ctx.json(Domain.validateProduct(body(ctx))))
       .post("/echo", ctx -> ctx.json(Domain.echo(body(ctx))))
       .post("/orders", ctx -> {
         ValidatedOrder v = Domain.validateOrder(body(ctx));
         ctx.header("location", "/orders/" + Domain.nextOrderId).status(201).json(v);
       })
       .post("/orders/{oid}/lines", ctx -> {
         int lines = Domain.getOrder(ctx.pathParam("oid")).lines().size();
         var v = Domain.validateLine(body(ctx));
         ctx.header("location", "/orders/" + ctx.pathParam("oid") + "/lines/" + (lines + 1))
            .status(201).json(v);
       })
       .put("/orders/{oid}", ctx -> {
         int id = Domain.getOrder(ctx.pathParam("oid")).id();
         ValidatedOrder v = Domain.validateOrder(body(ctx));
         ctx.json(new ValidatedOrderWithId(id, v.customerId(), v.status(), v.lines(),
                                           v.totalCents()));
       })
       .patch("/customers/{cid}",
              ctx -> ctx.json(Domain.patchCustomer(ctx.pathParam("cid"), body(ctx))))
       .delete("/orders/{oid}/lines/{lid}", ctx -> {
         Domain.getOrderLine(ctx.pathParam("oid"), ctx.pathParam("lid"));
         ctx.status(204);
       });
  }

  private Main() {}
}
