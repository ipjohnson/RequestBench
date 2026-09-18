package rb.quarkus.routes;

import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import rb.hosts.Hosts;

/**
 * baseline: dispatch floor, no serialization.
 *
 * One resource class per endpoint family. Forty-five methods in one file is a file nobody
 * reads, and a family is the unit a rewiring or a rerun is scoped to.
 */
@Path("/")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class Baseline {

  // The content type is set on the response rather than declared with @Produces. JAX-RS
  // matches @Produces against the request's Accept header, and the gate sends
  // Accept: application/json on every request, so a text/plain-only method is a 406.
  // rb:handler baseline.*
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
  @Path("__meta")
  public Map<String, Object> meta() {
    return Hosts.meta("quarkus", Hosts.version("quarkus"), "qute " + Hosts.version("quarkus"),
                      "sha1 (jax-rs compares, it does not hash)", "a shared LRU");
  }
}
