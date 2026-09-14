package rb.micronaut;

import io.micronaut.http.HttpRequest;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.MediaType;
import io.micronaut.http.annotation.Body;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Delete;
import io.micronaut.http.annotation.Error;
import io.micronaut.http.annotation.Get;
import io.micronaut.http.annotation.Patch;
import io.micronaut.http.annotation.Post;
import io.micronaut.http.annotation.Put;
import io.micronaut.runtime.Micronaut;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import rb.domain.Domain;
import rb.domain.Errors;
import rb.domain.Model.ValidatedOrder;
import rb.domain.Model.ValidatedOrderWithId;
import rb.hosts.Hosts;

/** RequestBench target: Micronaut. Framework wiring only; behaviour from rb-shared. */
@Controller
public class Main {

  public static void main(String[] args) throws Exception {
    Domain.load(Hosts.fixture());
    // PORT rather than MICRONAUT_SERVER_PORT, because every target reads the same variable.
    System.setProperty("micronaut.server.port", String.valueOf(Hosts.port()));
    Hosts.serializer("jackson " + Hosts.version("jackson"));
    Micronaut.run(Main.class, args);
  }

  private static Map<String, List<String>> q(HttpRequest<?> request) {
    Map<String, List<String>> out = new LinkedHashMap<>();
    request.getParameters().forEach(e -> out.put(e.getKey(), e.getValue()));
    return out;
  }

  // The content type is set on the response rather than declared with @Produces, which
  // restricts matching against the gate's Accept: application/json.
  @Get("/plaintext")
  HttpResponse<String> plaintext() {
    return HttpResponse.ok("Hello, World!").contentType(MediaType.TEXT_PLAIN);
  }

  @Get("/health")
  HttpResponse<String> health() {
    return HttpResponse.ok("ok").contentType(MediaType.TEXT_PLAIN);
  }

  @Get("/json/small")
  Object jsonSmall() {
    return Domain.jsonSmall();
  }

  @Get("/products")
  Object products(HttpRequest<?> request) {
    return Domain.listProducts(q(request));
  }

  @Get("/customers")
  Object customers(HttpRequest<?> request) {
    return Domain.listCustomers(q(request));
  }

  @Get("/orders")
  Object orders(HttpRequest<?> request) {
    return Domain.listOrders(q(request));
  }

  @Get("/search")
  Object search(HttpRequest<?> request) {
    return Domain.search(q(request));
  }

  @Get("/dashboard")
  Object dashboard() {
    return Domain.dashboard();
  }

  @Get("/__meta")
  Object meta() {
    return Hosts.meta("micronaut", Hosts.version("micronaut"));
  }

  @Get("/boom")
  Object boom() {
    throw new Errors.Boom();
  }

  @Get("/forbidden")
  HttpResponse<Object> forbidden() {
    return HttpResponse.status(io.micronaut.http.HttpStatus.FORBIDDEN)
                       .body(Map.of("error", "forbidden"));
  }

  @Get("/products/{pid}")
  Object product(String pid) {
    return Domain.getProduct(pid);
  }

  @Get("/customers/{cid}")
  Object customer(String cid) {
    return Domain.getCustomer(cid);
  }

  @Get("/orders/{oid}")
  Object order(String oid) {
    return Domain.getOrder(oid);
  }

  @Get("/products/{pid}/reviews")
  Object reviews(String pid) {
    return Domain.getProductReviews(pid);
  }

  @Get("/products/{pid}/related")
  Object related(String pid) {
    return Domain.relatedProducts(pid);
  }

  @Get("/customers/{cid}/orders")
  Object customerOrders(String cid) {
    return Domain.getCustomerOrders(cid);
  }

  @Get("/customers/{cid}/summary")
  Object summary(String cid) {
    return Domain.customerSummary(cid);
  }

  @Get("/orders/{oid}/lines")
  Object orderLines(String oid) {
    return Domain.getOrderLines(oid);
  }

  @Get("/orders/{oid}/full")
  Object orderFull(String oid) {
    return Domain.orderFull(oid);
  }

  @Get("/regions/{r}/customers")
  Object regionCustomers(String r) {
    return Domain.getRegionCustomers(r);
  }

  @Get("/regions/{r}/report")
  Object regionReport(String r) {
    return Domain.regionReport(r);
  }

  @Get("/customers/{cid}/orders/{oid}")
  Object customerOrder(String cid, String oid) {
    return Domain.getCustomerOrder(cid, oid);
  }

  @Get("/orders/{oid}/lines/{lid}")
  Object orderLine(String oid, String lid) {
    return Domain.getOrderLine(oid, lid);
  }

  @Get("/regions/{r}/customers/{cid}/orders/{oid}/lines/{lid}")
  Object deep(String r, String cid, String oid, String lid) {
    return Domain.getOrderLine(oid, lid);
  }

  @Post("/orders/validate")
  Object validateOrder(@Body Map<String, Object> body) {
    return Domain.validateOrder(body);
  }

  @Post("/customers/validate")
  Object validateCustomer(@Body Map<String, Object> body) {
    return Domain.validateCustomer(body);
  }

  @Post("/products/validate")
  Object validateProduct(@Body Map<String, Object> body) {
    return Domain.validateProduct(body);
  }

  @Post("/echo")
  Object echo(@Body Map<String, Object> body) {
    return Domain.echo(body);
  }

  @Post("/orders")
  HttpResponse<Object> createOrder(@Body Map<String, Object> body) {
    ValidatedOrder v = Domain.validateOrder(body);
    return HttpResponse.created((Object) v)
                       .header("location", "/orders/" + Domain.nextOrderId);
  }

  @Post("/orders/{oid}/lines")
  HttpResponse<Object> addLine(String oid, @Body Map<String, Object> body) {
    int lines = Domain.getOrder(oid).lines().size();
    Object v = Domain.validateLine(body);
    return HttpResponse.created(v)
                       .header("location", "/orders/" + oid + "/lines/" + (lines + 1));
  }

  @Put("/orders/{oid}")
  Object replaceOrder(String oid, @Body Map<String, Object> body) {
    int id = Domain.getOrder(oid).id();
    ValidatedOrder v = Domain.validateOrder(body);
    return new ValidatedOrderWithId(id, v.customerId(), v.status(), v.lines(),
                                    v.totalCents());
  }

  @Patch("/customers/{cid}")
  Object patchCustomer(String cid, @Body Map<String, Object> body) {
    return Domain.patchCustomer(cid, body);
  }

  @Delete("/orders/{oid}/lines/{lid}")
  HttpResponse<Void> deleteLine(String oid, String lid) {
    Domain.getOrderLine(oid, lid);
    return HttpResponse.noContent();
  }

  @Error(global = true, exception = Errors.NotFound.class)
  HttpResponse<Object> notFound() {
    return HttpResponse.notFound(Map.of("error", "not_found"));
  }

  @Error(global = true, exception = Errors.Validation.class)
  HttpResponse<Object> invalid(Errors.Validation e) {
    Map<String, Object> b = new LinkedHashMap<>(2);
    b.put("error", "validation_failed");
    b.put("errors", e.errors());
    return HttpResponse.unprocessableEntity().body(b);
  }

  @Error(global = true, exception = Exception.class)
  HttpResponse<Object> internal(Exception e) {
    Map<String, String> b = new LinkedHashMap<>(2);
    b.put("error", "internal");
    b.put("message", e.getMessage() == null ? "internal" : e.getMessage());
    return HttpResponse.serverError(b);
  }

  /** Unmatched paths. Micronaut's own 404 body is not the one the contract asks for. */
  @Error(global = true, status = io.micronaut.http.HttpStatus.NOT_FOUND)
  HttpResponse<Object> unmatched() {
    return HttpResponse.notFound(Map.of("error", "not_found"));
  }
}
