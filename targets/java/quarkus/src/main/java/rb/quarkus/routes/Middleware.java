package rb.quarkus.routes;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import rb.domain.Domain;
import rb.domain.Model.PayloadBody;
import rb.quarkus.Layers;

/**
 * middleware: per-layer dispatch cost at 0, 4 and 16 no-op layers.
 *
 * The layers themselves are in filters/, one provider each, bound to these methods by the
 * name bindings in Layers. JAX-RS resolves providers from annotations at deployment, so one
 * provider is one layer and the counts are written out.
 */
@Path("/middleware")
@Produces(MediaType.APPLICATION_JSON)
public class Middleware {

  // rb:snippet middleware.none
  @GET
  @Path("none")
  public PayloadBody none() {
    return Domain.payload("small");
  }

  // rb:snippet middleware.four
  @GET
  @Path("four")
  @Layers.Four
  public PayloadBody four() {
    return Domain.payload("small");
  }

  // rb:snippet middleware.sixteen
  @GET
  @Path("sixteen")
  @Layers.Sixteen
  public PayloadBody sixteen() {
    return Domain.payload("small");
  }
}
