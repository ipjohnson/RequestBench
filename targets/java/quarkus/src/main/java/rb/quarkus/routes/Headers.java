package rb.quarkus.routes;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import rb.domain.Domain;
import rb.domain.Model.PayloadBody;

/**
 * headers: eager against lazy construction of the request header map.
 *
 * The handler reads no header at all, so headers.many minus headers.few is the cost of
 * materialising 27 nobody asked for.
 */
@Path("/headers")
@Produces(MediaType.APPLICATION_JSON)
public class Headers {

  // rb:snippet headers.few headers.many
  @GET
  public PayloadBody headers() {
    return Domain.payload("small");
  }
}
