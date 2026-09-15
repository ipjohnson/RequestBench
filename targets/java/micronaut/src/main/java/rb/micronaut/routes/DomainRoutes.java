package rb.micronaut.routes;

import io.micronaut.http.HttpHeaders;
import io.micronaut.http.HttpRequest;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.annotation.Body;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Delete;
import io.micronaut.http.annotation.Get;
import io.micronaut.http.annotation.Patch;
import io.micronaut.http.annotation.Post;
import io.micronaut.http.annotation.Put;
import java.util.Map;
import rb.domain.Domain;
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
  HttpResponse<ValidatedOrder> create(@Body Map<String, Object> body) {
    return HttpResponse.created(Domain.validateOrder(body))
                       .header(HttpHeaders.LOCATION, Domain.createdLocation());
  }

  @Get("/domain/orders/{oid}")
  Order lookup(String oid) {
    return Domain.getOrder(oid);
  }

  @Put("/domain/orders/{oid}")
  ValidatedOrderWithId replace(String oid, @Body Map<String, Object> body) {
    int id = Domain.getOrder(oid).id();
    ValidatedOrder v = Domain.validateOrder(body);
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
