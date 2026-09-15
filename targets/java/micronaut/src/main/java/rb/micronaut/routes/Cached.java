package rb.micronaut.routes;

import io.micronaut.http.HttpHeaders;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.HttpStatus;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import io.micronaut.http.annotation.Header;
import rb.domain.Domain;

/**
 * cached: validator headers and the conditional request.
 *
 * The ETag is pinned in the fixture, so this measures emitting the header and comparing it
 * rather than hashing the body.
 *
 * The comparison requires a non-empty header: matching a missing if-none-match against an
 * empty ETag answers 304 to a client that never asked a conditional question.
 */
@Controller
public class Cached {

  private static HttpResponse<?> serve(String size, String inm) {
    String etag = Domain.etagOf(size);
    if (!inm.isEmpty() && inm.equals(etag)) {
      return HttpResponse.status(HttpStatus.NOT_MODIFIED)
                         .header(HttpHeaders.ETAG, etag)
                         .header(HttpHeaders.CACHE_CONTROL, Domain.CACHEABLE)
                         .header("x-rb-serial", Domain.nextSerial());
    }
    return HttpResponse.ok(Domain.payload(size))
                       .header(HttpHeaders.ETAG, etag)
                       .header(HttpHeaders.CACHE_CONTROL, Domain.CACHEABLE)
                       .header("x-rb-serial", Domain.nextSerial());
  }

  @Get("/cached/small")
  HttpResponse<?> small(@Header(name = "if-none-match", defaultValue = "") String inm) {
    return serve("small", inm);
  }

  @Get("/cached/medium")
  HttpResponse<?> medium(@Header(name = "if-none-match", defaultValue = "") String inm) {
    return serve("medium", inm);
  }

  @Get("/cached/large")
  HttpResponse<?> large(@Header(name = "if-none-match", defaultValue = "") String inm) {
    return serve("large", inm);
  }
}
