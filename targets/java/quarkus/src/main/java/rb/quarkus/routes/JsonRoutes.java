package rb.quarkus.routes;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import rb.domain.Domain;
import rb.domain.Model.PayloadBody;

/**
 * json: the serializer and response buffering across three size regimes.
 *
 * Three static routes, not /json/{size}. The size set is fixed, so a capture would make the
 * router pay parameter cost on the family every other target serves from a static route.
 */
@Path("/json")
@Produces(MediaType.APPLICATION_JSON)
public class JsonRoutes {

  // rb:handler json.small
  @GET
  @Path("small")
  public PayloadBody small() {
    return Domain.payload("small");
  }

  // rb:handler json.medium
  @GET
  @Path("medium")
  public PayloadBody medium() {
    return Domain.payload("medium");
  }

  // rb:handler json.large
  @GET
  @Path("large")
  public PayloadBody large() {
    return Domain.payload("large");
  }
}
