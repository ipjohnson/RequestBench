package rb.quarkus.routes;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import rb.domain.Domain;

/**
 * compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
 *
 * These methods answer with the payload and nothing else. Whether it goes out gzipped is
 * decided by Quarkus's own compression, which application.properties turns on for the whole
 * HTTP server.
 */
@Path("/compressed")
@Produces(MediaType.APPLICATION_JSON)
public class Compressed {

  // rb:handler compressed.identity_small,compressed.gzip_small
  @GET
  @Path("small")
  public Response small() {
    return Response.ok(Domain.payload("small")).header("x-rb-serial", Domain.nextSerial()).build();
  }

  @GET
  @Path("medium")
  public Response medium() {
    return Response.ok(Domain.payload("medium")).header("x-rb-serial", Domain.nextSerial()).build();
  }

  // rb:handler compressed.identity_large,compressed.gzip_large
  @GET
  @Path("large")
  public Response large() {
    return Response.ok(Domain.payload("large")).header("x-rb-serial", Domain.nextSerial()).build();
  }
}
