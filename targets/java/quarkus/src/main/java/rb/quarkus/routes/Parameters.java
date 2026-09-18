package rb.quarkus.routes;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import rb.domain.Domain;
import rb.domain.Model.PayloadBody;
import rb.domain.Model.PayloadWithEcho;

/**
 * parameters: router captures with segment depth held constant.
 *
 * JAX-RS's own binding: @PathParam names the capture and the method signature declares its
 * type, and RESTEasy converts it before the method runs. The static route needs no ordering
 * to win over {one}/segment/literal, because JAX-RS prefers the path with more literal
 * characters.
 */
@Path("/parameters")
@Produces(MediaType.APPLICATION_JSON)
public class Parameters {

  record One(int one) {}

  record Two(int one, int two) {}

  // rb:handler parameters.static
  @GET
  @Path("static/segment/literal")
  public PayloadBody staticPath() {
    return Domain.payload("small");
  }

  // rb:handler parameters.one
  @GET
  @Path("{one}/segment/literal")
  public PayloadWithEcho one(@PathParam("one") int one) {
    return Domain.withEcho("small", new One(one));
  }

  // rb:handler parameters.two
  @GET
  @Path("{one}/with-second/{two}")
  public PayloadWithEcho two(@PathParam("one") int one, @PathParam("two") int two) {
    return Domain.withEcho("small", new Two(one, two));
  }
}
