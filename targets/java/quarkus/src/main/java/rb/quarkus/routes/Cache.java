package rb.quarkus.routes;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import rb.domain.Domain;
import rb.domain.ResponseStore;

/**
 * cache: the handler skipped and a stored response replayed.
 *
 * Quarkus ships @CacheResult, which caches what a method returned. It is not wired here:
 * the extension is not in this target's dependencies and adding it would put a build-time
 * augmentation step in the way of one family. What runs instead is a resource method that
 * consults the shared store before it builds anything, which is the same store the other
 * targets without a framework cache use and is declared as such in /__meta.
 *
 * The key is the path plus the header values a row varies on, which arrive as parameters
 * for that reason alone.
 */
@Path("/cache")
@Produces(MediaType.APPLICATION_JSON)
public class Cache {

  // rb:wiring cache.*
  private static final ResponseStore STORE = new ResponseStore();

  // rb:wiring cache.*
  private static Response serve(String size, String key, List<String> vary) {
    ResponseStore.Stored hit = STORE.get(key);
    if (hit != null) {
      Response.ResponseBuilder b = Response.status(hit.status()).entity(hit.body());
      hit.headers().forEach((name, values) -> values.forEach(v -> b.header(name, v)));
      return b.build();
    }
    byte[] raw = rb.domain.Json.bytes(Domain.payload(size));
    java.util.Map<String, List<String>> headers = new java.util.LinkedHashMap<>();
    headers.put("x-rb-serial", List.of(Domain.nextSerial()));
    if (!vary.isEmpty()) {
      headers.put("vary", List.of(String.join(", ", vary)));
    }
    STORE.put(key, new ResponseStore.Stored(200, headers, raw));
    Response.ResponseBuilder b = Response.ok(raw);
    headers.forEach((name, values) -> values.forEach(v -> b.header(name, v)));
    return b.build();
  }

  // rb:handler cache.small
  @GET
  @Path("small")
  public Response small() {
    return serve("small", "/cache/small", List.of());
  }

  // rb:handler cache.medium
  @GET
  @Path("medium")
  public Response medium() {
    return serve("medium", "/cache/medium", List.of());
  }

  // rb:handler cache.large
  @GET
  @Path("large")
  public Response large() {
    return serve("large", "/cache/large", List.of());
  }

  // rb:handler cache.vary_one
  @GET
  @Path("vary/one")
  public Response varyOne(@HeaderParam("x-rb-tenant") String tenant) {
    return serve("small", ResponseStore.key("/cache/vary/one", List.of(nullToEmpty(tenant))),
                 Domain.varyOn("one"));
  }

  // rb:handler cache.vary_many
  @GET
  @Path("vary/many")
  public Response varyMany(@HeaderParam("x-rb-channel") String channel,
                           @HeaderParam("x-rb-region") String region,
                           @HeaderParam("x-rb-tenant") String tenant) {
    return serve("small",
                 ResponseStore.key("/cache/vary/many",
                                   List.of(nullToEmpty(channel), nullToEmpty(region),
                                           nullToEmpty(tenant))),
                 Domain.varyOn("many"));
  }

  private static String nullToEmpty(String v) {
    return v == null ? "" : v;
  }
}
