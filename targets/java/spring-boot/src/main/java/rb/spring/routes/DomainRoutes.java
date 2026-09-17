package rb.spring.routes;

import java.util.Map;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import rb.domain.Domain;
import rb.spring.OrderIn;
import rb.domain.Model.Customer;
import rb.domain.Model.JoinSummary;
import rb.domain.Model.Order;
import rb.domain.Model.OrdersPage;
import rb.domain.Model.Report;
import rb.domain.Model.ValidatedOrder;
import rb.domain.Model.ValidatedOrderWithId;
import rb.spring.Support;

/** domain: application-shaped handler work and the write methods. */
@RestController
public class DomainRoutes {

  @GetMapping("/domain/orders")
  OrdersPage filter(@RequestParam Map<String, String> q) {
    return Domain.domainFilter(Support.query(q));
  }

  @PostMapping("/domain/orders")
  ResponseEntity<ValidatedOrder> create(@Valid @RequestBody OrderIn body) {
    return ResponseEntity.status(201)
        .header(HttpHeaders.LOCATION, Domain.createdLocation())
        .body(body.order());
  }

  @GetMapping("/domain/orders/{oid}")
  Order lookup(@PathVariable String oid) {
    return Domain.getOrder(oid);
  }

  @PutMapping("/domain/orders/{oid}")
  ValidatedOrderWithId replace(@PathVariable String oid,
                               @Valid @RequestBody OrderIn body) {
    int id = Domain.getOrder(oid).id();
    ValidatedOrder v = body.order();
    return new ValidatedOrderWithId(id, v.customerId(), v.status(), v.lines(), v.totalCents());
  }

  @GetMapping("/domain/customers/{cid}/summary")
  JoinSummary summary(@PathVariable String cid) {
    return Domain.domainJoin(cid);
  }

  @GetMapping("/domain/regions/{region}/report")
  Report report(@PathVariable String region) {
    return Domain.domainAggregate(region);
  }

  @PatchMapping("/domain/customers/{cid}")
  Customer patch(@PathVariable String cid, @RequestBody Map<String, Object> body) {
    return Domain.patchCustomer(cid, body);
  }

  @DeleteMapping("/domain/orders/{oid}/lines/{lid}")
  ResponseEntity<Void> delete(@PathVariable String oid, @PathVariable String lid) {
    Domain.getOrderLine(oid, lid);
    return ResponseEntity.noContent().build();
  }
}
