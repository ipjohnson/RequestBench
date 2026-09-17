package rb.micronaut.routes;

import io.micronaut.http.HttpHeaders;
import io.micronaut.http.HttpRequest;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.annotation.Body;
import jakarta.validation.Valid;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Delete;
import io.micronaut.http.annotation.Get;
import io.micronaut.http.annotation.Patch;
import io.micronaut.http.annotation.Post;
import io.micronaut.http.annotation.Put;
import java.util.Map;
import rb.domain.Domain;
import rb.micronaut.OrderIn;
import rb.domain.Model.Customer;
import rb.domain.Model.JoinSummary;
import rb.domain.Model.Order;
import rb.domain.Model.OrdersPage;
import rb.domain.Model.Report;
import rb.domain.Model.ValidatedOrder;
import rb.domain.Model.ValidatedOrderWithId;
import rb.micronaut.Support;

/** domain: application-shaped handler work and the write methods. */
@Controller
public class DomainRoutes {

  @Get("/domain/orders")
  OrdersPage filter(HttpRequest<?> request) {
    return Domain.domainFilter(Support.query(request));
  }

  @Post("/domain/orders")
  HttpResponse<ValidatedOrder> create(@Valid @Body OrderIn body) {
    return HttpResponse.created(body.order())
                       .header(HttpHeaders.LOCATION, Domain.createdLocation());
  }

  @Get("/domain/orders/{oid}")
  Order lookup(String oid) {
    return Domain.getOrder(oid);
  }

  @Put("/domain/orders/{oid}")
  ValidatedOrderWithId replace(String oid, @Valid @Body OrderIn body) {
    int id = Domain.getOrder(oid).id();
    ValidatedOrder v = body.order();
    return new ValidatedOrderWithId(id, v.customerId(), v.status(), v.lines(), v.totalCents());
  }

  @Get("/domain/customers/{cid}/summary")
  JoinSummary summary(String cid) {
    return Domain.domainJoin(cid);
  }

  @Get("/domain/regions/{region}/report")
  Report report(String region) {
    return Domain.domainAggregate(region);
  }

  @Patch("/domain/customers/{cid}")
  Customer patch(String cid, @Body Map<String, Object> body) {
    return Domain.patchCustomer(cid, body);
  }

  @Delete("/domain/orders/{oid}/lines/{lid}")
  HttpResponse<?> delete(String oid, String lid) {
    Domain.getOrderLine(oid, lid);
    return HttpResponse.noContent();
  }
}
