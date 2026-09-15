package rb.quarkus.routes;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import rb.domain.Domain;
import rb.hosts.Views;

/**
 * template: server-side rendering of the same model the json family serializes.
 *
 * The engine is jmustache, shared with every other Java target and named on /__meta.
 */
@Path("/template")
@Produces(MediaType.APPLICATION_JSON)
public class Templates {

  // rb:snippet template.small
  @GET
  @Path("small")
  public Response small() {
    return Response.ok(Views.renderItems(Domain.payload("small")))
                   .type(MediaType.TEXT_HTML).build();
  }

  // rb:snippet template.medium
  @GET
  @Path("medium")
  public Response medium() {
    return Response.ok(Views.renderItems(Domain.payload("medium")))
                   .type(MediaType.TEXT_HTML).build();
  }
}
