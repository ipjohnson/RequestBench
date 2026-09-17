package rb.micronaut.routes;

import io.micronaut.http.HttpHeaders;
import io.micronaut.http.HttpRequest;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.HttpStatus;
import io.micronaut.http.MediaType;
import io.micronaut.http.MutableHttpResponse;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import io.micronaut.http.annotation.ResponseFilter;
import io.micronaut.http.annotation.ServerFilter;
import rb.domain.Domain;
import rb.domain.Json;

/**
 * etag: a Micronaut server filter scoped to the route pattern.
 *
 * Micronaut ships no conditional handling, so the digest is the shared one and /__meta says
 * so. What is Micronaut's own is the filter and its pattern: @ServerFilter takes the paths
 * it applies to, so the hash reaches these two routes and not the forty-six it would
 * otherwise tax.
 *
 * The filter serializes the body the controller returned, hashes those bytes, and puts them
 * back as the response body, so the serialization happens once rather than once for the
 * hash and once for the writer.
 */
@ServerFilter("/etag/**")
public class Etag {

  @ResponseFilter
  public void revalidate(HttpRequest<?> request, MutableHttpResponse<?> response) {
    Object body = response.body();
    if (body == null) {
      return;
    }
    byte[] raw = Json.bytes(body);
    String etag = Domain.contentETag(raw);
    response.header(HttpHeaders.ETAG, etag);
    response.header(HttpHeaders.CACHE_CONTROL, Domain.CACHEABLE);
    if (etag.equals(request.getHeaders().get(HttpHeaders.IF_NONE_MATCH))) {
      response.status(HttpStatus.NOT_MODIFIED).body(null);
      return;
    }
    response.contentType(MediaType.APPLICATION_JSON_TYPE).body(raw);
  }

  @Controller
  public static class Routes {

    private static HttpResponse<?> serve(String size) {
      return HttpResponse.ok(Domain.payload(size)).header("x-rb-serial", Domain.nextSerial());
    }

    // rb:snippet etag.small etag.large etag.match_large etag.stale_large
    @Get("/etag/small")
    HttpResponse<?> small() {
      return serve("small");
    }

    @Get("/etag/large")
    HttpResponse<?> large() {
      return serve("large");
    }
  }
}
