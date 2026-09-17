package rb.micronaut.routes;

import io.micronaut.http.HttpResponse;
import io.micronaut.http.MediaType;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import io.micronaut.http.annotation.Header;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import rb.domain.Domain;
import rb.domain.Json;
import rb.domain.ResponseStore;

/**
 * cache: the handler skipped and a stored response replayed.
 *
 * Micronaut ships @Cacheable, which caches what a method returned. It is not wired here:
 * the cache module is not in this target's dependencies and adding it would put another
 * annotation processor in the build for one family. What runs instead is the shared store,
 * consulted before anything is built, which is the same store the other targets without a
 * framework cache use and is declared as such in /__meta.
 *
 * The header values a row varies on arrive as parameters for that reason alone: the key is
 * the path plus those values.
 */
@Controller
public class Cache {

  private static final ResponseStore STORE = new ResponseStore();

  private static HttpResponse<?> serve(String size, String key, List<String> vary) {
    ResponseStore.Stored hit = STORE.get(key);
    if (hit != null) {
      MutableResponse replay = new MutableResponse(hit);
      return replay.build();
    }
    byte[] raw = Json.bytes(Domain.payload(size));
    Map<String, List<String>> headers = new LinkedHashMap<>();
    headers.put("x-rb-serial", List.of(Domain.nextSerial()));
    if (!vary.isEmpty()) {
      headers.put("vary", List.of(String.join(", ", vary)));
    }
    STORE.put(key, new ResponseStore.Stored(200, headers, raw));
    return written(raw, headers);
  }

  private static HttpResponse<?> written(byte[] raw, Map<String, List<String>> headers) {
    io.micronaut.http.MutableHttpResponse<byte[]> response =
        HttpResponse.ok(raw).contentType(MediaType.APPLICATION_JSON_TYPE);
    headers.forEach((name, values) -> values.forEach(v -> response.header(name, v)));
    return response;
  }

  /** A stored response, written back out. */
  private record MutableResponse(ResponseStore.Stored hit) {
    HttpResponse<?> build() {
      return written(hit.body(), hit.headers());
    }
  }

  // rb:snippet cache.small cache.medium cache.large
  @Get("/cache/small")
  HttpResponse<?> small() {
    return serve("small", "/cache/small", List.of());
  }

  @Get("/cache/medium")
  HttpResponse<?> medium() {
    return serve("medium", "/cache/medium", List.of());
  }

  @Get("/cache/large")
  HttpResponse<?> large() {
    return serve("large", "/cache/large", List.of());
  }

  // rb:snippet cache.vary_one cache.vary_many
  @Get("/cache/vary/one")
  HttpResponse<?> varyOne(@Header(name = "x-rb-tenant", defaultValue = "") String tenant) {
    return serve("small", ResponseStore.key("/cache/vary/one", List.of(tenant)),
                 Domain.varyOn("one"));
  }

  @Get("/cache/vary/many")
  HttpResponse<?> varyMany(@Header(name = "x-rb-channel", defaultValue = "") String channel,
                           @Header(name = "x-rb-region", defaultValue = "") String region,
                           @Header(name = "x-rb-tenant", defaultValue = "") String tenant) {
    return serve("small",
                 ResponseStore.key("/cache/vary/many", List.of(channel, region, tenant)),
                 Domain.varyOn("many"));
  }
}
