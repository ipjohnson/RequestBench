package rb.quarkus.routes;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import rb.domain.Domain;
import rb.domain.Json;

/**
 * compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
 *
 * Quarkus enables compression on the whole HTTP server, which would put a "did the client
 * ask?" check on all forty-five endpoints and contaminate the rows this family is measured
 * against. These three methods carry it instead, with the codec pinned across every
 * language.
 */
@Path("/compressed")
@Produces(MediaType.APPLICATION_JSON)
public class Compressed {

  /** The floor the Java stacks use, so gzip_small lands on the same side of it. */
  // rb:wiring compressed.*
  private static final int THRESHOLD = 1024;

  // rb:wiring compressed.*
  private static Response serve(String size, String accept) {
    byte[] raw = Json.bytes(Domain.payload(size));
    boolean wanted = accept != null && accept.contains("gzip") && raw.length >= THRESHOLD;
    byte[] out = wanted ? Domain.gzip(raw) : raw;
    Response.ResponseBuilder b = Response.ok(out)
        .type(MediaType.APPLICATION_JSON)
        .header("x-rb-serial", Domain.nextSerial());
    if (wanted) {
      b.header("content-encoding", "gzip").header("vary", "Accept-Encoding");
    }
    return b.build();
  }

  // rb:handler compressed.identity_small,compressed.gzip_small
  @GET
  @Path("small")
  public Response small(@HeaderParam("accept-encoding") String accept) {
    return serve("small", accept);
  }

  @GET
  @Path("medium")
  public Response medium(@HeaderParam("accept-encoding") String accept) {
    return serve("medium", accept);
  }

  // rb:handler compressed.identity_large,compressed.gzip_large
  @GET
  @Path("large")
  public Response large(@HeaderParam("accept-encoding") String accept) {
    return serve("large", accept);
  }
}
