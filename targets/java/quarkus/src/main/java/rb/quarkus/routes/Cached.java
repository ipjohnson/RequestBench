package rb.quarkus.routes;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import rb.domain.Domain;

/**
 * cached: validator headers and the conditional request.
 *
 * The ETag is pinned in the fixture, so this measures emitting the header and comparing it
 * rather than hashing the body. JAX-RS's Request.evaluatePreconditions would work from an
 * EntityTag it built, and it also consults Last-Modified; this family is only about the one
 * comparison.
 *
 * The comparison requires a non-empty header: matching a missing if-none-match against an
 * empty ETag answers 304 to a client that never asked a conditional question.
 */
@Path("/cached")
@Produces(MediaType.APPLICATION_JSON)
public class Cached {

  private static Response serve(String size, String inm) {
    String etag = Domain.etagOf(size);
    Response.ResponseBuilder b = inm != null && inm.equals(etag)
        ? Response.status(304)
        : Response.ok(Domain.payload(size));
    return b.header("etag", etag)
            .header("cache-control", Domain.CACHEABLE)
            .header("x-rb-serial", Domain.nextSerial())
            .build();
  }

  // rb:snippet cached.small
  @GET
  @Path("small")
  public Response small(@HeaderParam("if-none-match") String inm) {
    return serve("small", inm);
  }

  // rb:snippet cached.medium
  @GET
  @Path("medium")
  public Response medium(@HeaderParam("if-none-match") String inm) {
    return serve("medium", inm);
  }

  // rb:snippet cached.large cached.revalidate
  @GET
  @Path("large")
  public Response large(@HeaderParam("if-none-match") String inm) {
    return serve("large", inm);
  }
}
