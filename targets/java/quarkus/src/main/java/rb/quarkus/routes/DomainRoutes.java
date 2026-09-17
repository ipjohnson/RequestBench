package rb.quarkus.routes;

import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.validation.Valid;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import rb.domain.Domain;
import rb.quarkus.OrderIn;
import rb.domain.Model.Customer;
import rb.domain.Model.JoinSummary;
import rb.domain.Model.Order;
import rb.domain.Model.OrdersPage;
import rb.domain.Model.Report;
import rb.domain.Model.ValidatedOrder;
import rb.domain.Model.ValidatedOrderWithId;

/** domain: application-shaped handler work and the write methods. */
@Path("/domain")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class DomainRoutes {

  // rb:snippet domain.filter
  @GET
  @Path("orders")
  public OrdersPage filter(@QueryParam("page") @DefaultValue("0") int page,
                           @QueryParam("size") @DefaultValue("25") int size,
                           @QueryParam("status") @DefaultValue("") String status) {
    return Domain.domainFilter(page, size, status);
  }

  // rb:snippet domain.create
  @POST
  @Path("orders")
  public Response create(@Valid OrderIn body) {
    ValidatedOrder v = body.order();
    return Response.status(201).header("location", Domain.createdLocation()).entity(v).build();
  }

  // rb:snippet domain.lookup errors.not_found
  @GET
  @Path("orders/{oid}")
  public Order lookup(@PathParam("oid") String oid) {
    return Domain.getOrder(oid);
  }

  // rb:snippet domain.replace
  @PUT
  @Path("orders/{oid}")
  public ValidatedOrderWithId replace(@PathParam("oid") String oid, @Valid OrderIn body) {
    int id = Domain.getOrder(oid).id();
    ValidatedOrder v = body.order();
    return new ValidatedOrderWithId(id, v.customerId(), v.status(), v.lines(), v.totalCents());
  }

  // rb:snippet domain.join
  @GET
  @Path("customers/{cid}/summary")
  public JoinSummary summary(@PathParam("cid") String cid) {
    return Domain.domainJoin(cid);
  }

  // rb:snippet domain.aggregate
  @GET
  @Path("regions/{region}/report")
  public Report report(@PathParam("region") String region) {
    return Domain.domainAggregate(region);
  }

  // rb:snippet domain.patch
  @PATCH
  @Path("customers/{cid}")
  public Customer patch(@PathParam("cid") String cid, Map<String, Object> body) {
    return Domain.patchCustomer(cid, body);
  }

  // rb:snippet domain.delete
  @DELETE
  @Path("orders/{oid}/lines/{lid}")
  public Response delete(@PathParam("oid") String oid, @PathParam("lid") String lid) {
    Domain.getOrderLine(oid, lid);
    return Response.noContent().build();
  }
}
