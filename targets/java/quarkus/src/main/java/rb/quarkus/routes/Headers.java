package rb.quarkus.routes;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import rb.domain.Domain;
import rb.domain.Model.PayloadBody;
import rb.domain.Model.PayloadWithEcho;

/**
 * headers: the request header map, left unread and then bound.
 *
 * /headers reads no header at all, so headers.many minus headers.few is the cost of
 * materialising the 25 nobody asked for. /headers/bind binds three with JAX-RS's own
 * binding: @HeaderParam names the header and the method signature declares its type, and
 * RESTEasy converts x-rb-account to an int before the method runs, the way the query family
 * converts.
 */
@Path("/headers")
@Produces(MediaType.APPLICATION_JSON)
public class Headers {

  record Bound(String tenant, @JsonProperty("request_id") String requestId, int account) {}

  // rb:handler headers.few,headers.many
  @GET
  public PayloadBody headers() {
    return Domain.payload("small");
  }

  // rb:handler headers.bind_few,headers.bind_many
  @GET
  @Path("bind")
  public PayloadWithEcho bind(@HeaderParam("x-rb-tenant") String tenant,
                              @HeaderParam("x-rb-request-id") String requestId,
                              @HeaderParam("x-rb-account") int account) {
    return Domain.withEcho("small", new Bound(tenant, requestId, account));
  }
}
