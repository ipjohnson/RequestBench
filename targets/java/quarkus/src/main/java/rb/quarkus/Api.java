package rb.quarkus;

import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import java.util.Map;
import rb.domain.Domain;
import rb.domain.Errors;
import rb.domain.Model.ValidatedOrder;
import rb.domain.Model.ValidatedOrderWithId;
import rb.hosts.Hosts;

/** RequestBench target: Quarkus REST. Framework wiring only; behaviour from rb-shared. */
@Path("/")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class Api {

  private static Map<String, List<String>> q(UriInfo uriInfo) {
    return new java.util.LinkedHashMap<>(uriInfo.getQueryParameters());
  }

  // The content type is set on the response rather than declared with @Produces. JAX-RS
  // matches @Produces against the request's Accept header, and the conformance gate sends
  // Accept: application/json on every request, so a text/plain-only method is a 406.
  @GET
  @Path("plaintext")
  public Response plaintext() {
    return Response.ok("Hello, World!").type(MediaType.TEXT_PLAIN).build();
  }

  @GET
  @Path("health")
  public Response health() {
    return Response.ok("ok").type(MediaType.TEXT_PLAIN).build();
  }

  @GET
  @Path("json/small")
  public Object jsonSmall() {
    return Domain.jsonSmall();
  }

  @GET
  @Path("products")
  public Object products(@Context UriInfo uriInfo) {
    return Domain.listProducts(q(uriInfo));
  }

  @GET
  @Path("customers")
  public Object customers(@Context UriInfo uriInfo) {
    return Domain.listCustomers(q(uriInfo));
  }

  @GET
  @Path("orders")
  public Object orders(@Context UriInfo uriInfo) {
    return Domain.listOrders(q(uriInfo));
  }

  @GET
  @Path("search")
  public Object search(@Context UriInfo uriInfo) {
    return Domain.search(q(uriInfo));
  }

  @GET
  @Path("dashboard")
  public Object dashboard() {
    return Domain.dashboard();
  }

  @GET
  @Path("__meta")
  public Object meta() {
    return Hosts.meta("quarkus", Hosts.version("quarkus"));
  }

  @GET
  @Path("boom")
  public Object boom() {
    throw new Errors.Boom();
  }

  @GET
  @Path("forbidden")
  public Response forbidden() {
    return Response.status(403).entity(Map.of("error", "forbidden")).build();
  }

  @GET
  @Path("products/{pid}")
  public Object product(@PathParam("pid") String pid) {
    return Domain.getProduct(pid);
  }

  @GET
  @Path("customers/{cid}")
  public Object customer(@PathParam("cid") String cid) {
    return Domain.getCustomer(cid);
  }

  @GET
  @Path("orders/{oid}")
  public Object order(@PathParam("oid") String oid) {
    return Domain.getOrder(oid);
  }

  @GET
  @Path("products/{pid}/reviews")
  public Object reviews(@PathParam("pid") String pid) {
    return Domain.getProductReviews(pid);
  }

  @GET
  @Path("products/{pid}/related")
  public Object related(@PathParam("pid") String pid) {
    return Domain.relatedProducts(pid);
  }

  @GET
  @Path("customers/{cid}/orders")
  public Object customerOrders(@PathParam("cid") String cid) {
    return Domain.getCustomerOrders(cid);
  }

  @GET
  @Path("customers/{cid}/summary")
  public Object summary(@PathParam("cid") String cid) {
    return Domain.customerSummary(cid);
  }

  @GET
  @Path("orders/{oid}/lines")
  public Object orderLines(@PathParam("oid") String oid) {
    return Domain.getOrderLines(oid);
  }

  @GET
  @Path("orders/{oid}/full")
  public Object orderFull(@PathParam("oid") String oid) {
    return Domain.orderFull(oid);
  }

  @GET
  @Path("regions/{r}/customers")
  public Object regionCustomers(@PathParam("r") String r) {
    return Domain.getRegionCustomers(r);
  }

  @GET
  @Path("regions/{r}/report")
  public Object regionReport(@PathParam("r") String r) {
    return Domain.regionReport(r);
  }

  @GET
  @Path("customers/{cid}/orders/{oid}")
  public Object customerOrder(@PathParam("cid") String cid, @PathParam("oid") String oid) {
    return Domain.getCustomerOrder(cid, oid);
  }

  @GET
  @Path("orders/{oid}/lines/{lid}")
  public Object orderLine(@PathParam("oid") String oid, @PathParam("lid") String lid) {
    return Domain.getOrderLine(oid, lid);
  }

  @GET
  @Path("regions/{r}/customers/{cid}/orders/{oid}/lines/{lid}")
  public Object deep(@PathParam("oid") String oid, @PathParam("lid") String lid) {
    return Domain.getOrderLine(oid, lid);
  }

  @POST
  @Path("orders/validate")
  public Object validateOrder(Map<String, Object> body) {
    return Domain.validateOrder(body);
  }

  @POST
  @Path("customers/validate")
  public Object validateCustomer(Map<String, Object> body) {
    return Domain.validateCustomer(body);
  }

  @POST
  @Path("products/validate")
  public Object validateProduct(Map<String, Object> body) {
    return Domain.validateProduct(body);
  }

  @POST
  @Path("echo")
  public Object echo(Map<String, Object> body) {
    return Domain.echo(body);
  }

  @POST
  @Path("orders")
  public Response createOrder(Map<String, Object> body) {
    ValidatedOrder v = Domain.validateOrder(body);
    return Response.status(201).entity(v)
                   .header("location", "/orders/" + Domain.nextOrderId).build();
  }

  @POST
  @Path("orders/{oid}/lines")
  public Response addLine(@PathParam("oid") String oid, Map<String, Object> body) {
    int lines = Domain.getOrder(oid).lines().size();
    Object v = Domain.validateLine(body);
    return Response.status(201).entity(v)
                   .header("location", "/orders/" + oid + "/lines/" + (lines + 1)).build();
  }

  @PUT
  @Path("orders/{oid}")
  public Object replaceOrder(@PathParam("oid") String oid, Map<String, Object> body) {
    int id = Domain.getOrder(oid).id();
    ValidatedOrder v = Domain.validateOrder(body);
    return new ValidatedOrderWithId(id, v.customerId(), v.status(), v.lines(),
                                    v.totalCents());
  }

  @PATCH
  @Path("customers/{cid}")
  public Object patchCustomer(@PathParam("cid") String cid, Map<String, Object> body) {
    return Domain.patchCustomer(cid, body);
  }

  @DELETE
  @Path("orders/{oid}/lines/{lid}")
  public Response deleteLine(@PathParam("oid") String oid, @PathParam("lid") String lid) {
    Domain.getOrderLine(oid, lid);
    return Response.noContent().build();
  }
}
