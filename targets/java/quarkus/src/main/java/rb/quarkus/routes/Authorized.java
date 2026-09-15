package rb.quarkus.routes;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import rb.domain.Domain;
import rb.domain.Model.PayloadBody;
import rb.quarkus.Layers;

/**
 * authorized: the framework's authorization mechanism, crypto excluded.
 *
 * The check is filters/RequireToken, bound to this method by name.
 */
@Path("/authorized")
@Produces(MediaType.APPLICATION_JSON)
public class Authorized {

  // rb:snippet authorized.allowed authorized.denied
  @GET
  @Path("small")
  @Layers.Authorized
  public PayloadBody small() {
    return Domain.payload("small");
  }
}
