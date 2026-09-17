package rb.quarkus.routes;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import rb.domain.Domain;
import rb.domain.Model.PayloadBody;

/** parameters: router captures with segment depth held constant. */
@Path("/parameters")
@Produces(MediaType.APPLICATION_JSON)
public class Parameters {

  // rb:handler parameters.static
  @GET
  @Path("static/segment/literal")
  public PayloadBody staticPath() {
    return Domain.payload("small");
  }

  // rb:handler parameters.one
  @GET
  @Path("{one}")
  public PayloadBody one() {
    return Domain.payload("small");
  }

  // rb:handler parameters.two
  @GET
  @Path("{one}/with-second/{two}")
  public PayloadBody two() {
    return Domain.payload("small");
  }
}
