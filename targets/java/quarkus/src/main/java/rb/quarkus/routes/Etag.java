package rb.quarkus.routes;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.EntityTag;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Request;
import jakarta.ws.rs.core.Response;
import rb.domain.Domain;
import rb.domain.Json;

/**
 * etag: JAX-RS's own conditional machinery, which is what Quarkus REST gives a resource.
 *
 * Request.evaluatePreconditions takes the validator, compares it against If-None-Match and
 * builds the 304 itself, so nothing here compares anything. What it does not do is hash:
 * JAX-RS has no digest, so the target computes one over the body it is about to send and
 * /__meta says which.
 *
 * Shallow, which is the point: the body is serialized and hashed before anything is
 * compared, so the 304 saves the write and nothing else. The bytes are what goes back, so
 * the serialization happens once rather than once for the hash and once for the writer.
 */
@Path("/etag")
@Produces(MediaType.APPLICATION_JSON)
public class Etag {

  @Context
  Request request;

  private Response serve(String size) {
    byte[] raw = Json.bytes(Domain.payload(size));
    EntityTag tag = new EntityTag(Domain.contentETagValue(raw));
    Response.ResponseBuilder notModified = request.evaluatePreconditions(tag);
    Response.ResponseBuilder b = notModified != null ? notModified : Response.ok(raw);
    return b.tag(tag)
            .header("cache-control", Domain.CACHEABLE)
            .header("x-rb-serial", Domain.nextSerial())
            .build();
  }

  // rb:snippet etag.small
  @GET
  @Path("small")
  public Response small() {
    return serve("small");
  }

  // rb:snippet etag.large etag.match_large etag.stale_large
  @GET
  @Path("large")
  public Response large() {
    return serve("large");
  }
}
