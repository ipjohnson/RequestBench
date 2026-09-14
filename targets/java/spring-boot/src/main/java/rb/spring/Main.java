package rb.spring;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import rb.domain.Domain;
import rb.domain.Errors;
import rb.domain.Model.ValidatedOrder;
import rb.domain.Model.ValidatedOrderWithId;
import rb.hosts.Hosts;

/** RequestBench target: Spring Boot. Framework wiring only; behaviour from rb-shared. */
@SpringBootApplication
@RestController
public class Main {

  public static void main(String[] args) throws Exception {
    Domain.load(Hosts.fixture());
    // PORT rather than SERVER_PORT, because every target in every language reads the same
    // variable and the container contract names that one.
    System.setProperty("server.port", String.valueOf(Hosts.port()));
    // Spring Boot 4 serializes with Jackson 3, not the Jackson 2 the other targets share.
    // Its version comes from the spring-boot BOM rather than this repo's jackson pin.
    Hosts.serializer("jackson " + tools.jackson.core.Version.class.getPackage()
                                     .getImplementationVersion());
    SpringApplication app = new SpringApplication(Main.class);
    app.setBannerMode(org.springframework.boot.Banner.Mode.OFF);
    app.run(args);
  }

  private static Map<String, List<String>> q(Map<String, String> flat) {
    Map<String, List<String>> out = new LinkedHashMap<>(flat.size());
    flat.forEach((k, v) -> out.put(k, List.of(v)));
    return out;
  }

  // The content type is set on the response rather than with `produces`, which would
  // restrict matching: the conformance gate sends Accept: application/json on every
  // request, and a text/plain-only route does not match it at all.
  @GetMapping("/plaintext")
  ResponseEntity<String> plaintext() {
    return ResponseEntity.ok().contentType(MediaType.TEXT_PLAIN).body("Hello, World!");
  }

  @GetMapping("/health")
  ResponseEntity<String> health() {
    return ResponseEntity.ok().contentType(MediaType.TEXT_PLAIN).body("ok");
  }

  @GetMapping("/json/small")
  Object jsonSmall() {
    return Domain.jsonSmall();
  }

  @GetMapping("/products")
  Object products(@RequestParam Map<String, String> p) {
    return Domain.listProducts(q(p));
  }

  @GetMapping("/customers")
  Object customers(@RequestParam Map<String, String> p) {
    return Domain.listCustomers(q(p));
  }

  @GetMapping("/orders")
  Object orders(@RequestParam Map<String, String> p) {
    return Domain.listOrders(q(p));
  }

  @GetMapping("/search")
  Object search(@RequestParam Map<String, String> p) {
    return Domain.search(q(p));
  }

  @GetMapping("/dashboard")
  Object dashboard() {
    return Domain.dashboard();
  }

  @GetMapping("/__meta")
  Object meta() {
    return Hosts.meta("spring-boot", Hosts.version("spring-boot"));
  }

  @GetMapping("/boom")
  Object boom() {
    throw new Errors.Boom();
  }

  @GetMapping("/forbidden")
  ResponseEntity<Object> forbidden() {
    return ResponseEntity.status(403).body(Map.of("error", "forbidden"));
  }

  @GetMapping("/products/{pid}")
  Object product(@PathVariable String pid) {
    return Domain.getProduct(pid);
  }

  @GetMapping("/customers/{cid}")
  Object customer(@PathVariable String cid) {
    return Domain.getCustomer(cid);
  }

  @GetMapping("/orders/{oid}")
  Object order(@PathVariable String oid) {
    return Domain.getOrder(oid);
  }

  @GetMapping("/products/{pid}/reviews")
  Object reviews(@PathVariable String pid) {
    return Domain.getProductReviews(pid);
  }

  @GetMapping("/products/{pid}/related")
  Object related(@PathVariable String pid) {
    return Domain.relatedProducts(pid);
  }

  @GetMapping("/customers/{cid}/orders")
  Object customerOrders(@PathVariable String cid) {
    return Domain.getCustomerOrders(cid);
  }

  @GetMapping("/customers/{cid}/summary")
  Object summary(@PathVariable String cid) {
    return Domain.customerSummary(cid);
  }

  @GetMapping("/orders/{oid}/lines")
  Object orderLines(@PathVariable String oid) {
    return Domain.getOrderLines(oid);
  }

  @GetMapping("/orders/{oid}/full")
  Object orderFull(@PathVariable String oid) {
    return Domain.orderFull(oid);
  }

  @GetMapping("/regions/{r}/customers")
  Object regionCustomers(@PathVariable String r) {
    return Domain.getRegionCustomers(r);
  }

  @GetMapping("/regions/{r}/report")
  Object regionReport(@PathVariable String r) {
    return Domain.regionReport(r);
  }

  @GetMapping("/customers/{cid}/orders/{oid}")
  Object customerOrder(@PathVariable String cid, @PathVariable String oid) {
    return Domain.getCustomerOrder(cid, oid);
  }

  @GetMapping("/orders/{oid}/lines/{lid}")
  Object orderLine(@PathVariable String oid, @PathVariable String lid) {
    return Domain.getOrderLine(oid, lid);
  }

  @GetMapping("/regions/{r}/customers/{cid}/orders/{oid}/lines/{lid}")
  Object deep(@PathVariable String oid, @PathVariable String lid) {
    return Domain.getOrderLine(oid, lid);
  }

  @PostMapping("/orders/validate")
  Object validateOrder(@RequestBody Map<String, Object> body) {
    return Domain.validateOrder(body);
  }

  @PostMapping("/customers/validate")
  Object validateCustomer(@RequestBody Map<String, Object> body) {
    return Domain.validateCustomer(body);
  }

  @PostMapping("/products/validate")
  Object validateProduct(@RequestBody Map<String, Object> body) {
    return Domain.validateProduct(body);
  }

  @PostMapping("/echo")
  Object echo(@RequestBody Map<String, Object> body) {
    return Domain.echo(body);
  }

  @PostMapping("/orders")
  ResponseEntity<Object> createOrder(@RequestBody Map<String, Object> body) {
    ValidatedOrder v = Domain.validateOrder(body);
    return ResponseEntity.status(201)
                         .header("location", "/orders/" + Domain.nextOrderId)
                         .body(v);
  }

  @PostMapping("/orders/{oid}/lines")
  ResponseEntity<Object> addLine(@PathVariable String oid, @RequestBody Map<String, Object> body) {
    int lines = Domain.getOrder(oid).lines().size();
    var v = Domain.validateLine(body);
    return ResponseEntity.status(201)
                         .header("location", "/orders/" + oid + "/lines/" + (lines + 1))
                         .body(v);
  }

  @PutMapping("/orders/{oid}")
  Object replaceOrder(@PathVariable String oid, @RequestBody Map<String, Object> body) {
    int id = Domain.getOrder(oid).id();
    ValidatedOrder v = Domain.validateOrder(body);
    return new ValidatedOrderWithId(id, v.customerId(), v.status(), v.lines(),
                                    v.totalCents());
  }

  @PatchMapping("/customers/{cid}")
  Object patchCustomer(@PathVariable String cid, @RequestBody Map<String, Object> body) {
    return Domain.patchCustomer(cid, body);
  }

  @DeleteMapping("/orders/{oid}/lines/{lid}")
  ResponseEntity<Void> deleteLine(@PathVariable String oid, @PathVariable String lid) {
    Domain.getOrderLine(oid, lid);
    return ResponseEntity.noContent().build();
  }

  /**
   * Unmatched paths. Spring's own 404 body is a Boot error object rather than the one the
   * contract asks for, and a pattern this general ranks below every route above it.
   */
  @RequestMapping("/**")
  ResponseEntity<Object> unmatched() {
    return ResponseEntity.status(404).body(Map.of("error", "not_found"));
  }

  @RestControllerAdvice
  static class Errors2 {
    @ExceptionHandler(Errors.NotFound.class)
    ResponseEntity<Object> notFound(Errors.NotFound e) {
      return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "not_found"));
    }

    @ExceptionHandler(Errors.Validation.class)
    ResponseEntity<Object> invalid(Errors.Validation e) {
      Map<String, Object> b = new LinkedHashMap<>(2);
      b.put("error", "validation_failed");
      b.put("errors", e.errors());
      return ResponseEntity.status(422).body(b);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<Object> internal(Exception e) {
      Map<String, String> b = new LinkedHashMap<>(2);
      b.put("error", "internal");
      b.put("message", e.getMessage() == null ? "internal" : e.getMessage());
      return ResponseEntity.status(500).body(b);
    }
  }
}
