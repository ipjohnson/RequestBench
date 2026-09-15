package rb.spring.routes;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;
import rb.domain.Domain;

/**
 * cached: validator headers and the conditional request.
 *
 * The ETag is pinned in the fixture, so this measures emitting the header and comparing it
 * rather than hashing the body. Spring's ShallowEtagHeaderFilter computes its own digest
 * and could not produce the pinned value.
 *
 * The comparison requires a non-empty header: matching a missing if-none-match against an
 * empty ETag answers 304 to a client that never asked a conditional question.
 */
@RestController
public class Cached {

  private static ResponseEntity<Object> serve(String size, String inm) {
    String etag = Domain.etagOf(size);
    ResponseEntity.BodyBuilder b = ResponseEntity.ok()
        .header(HttpHeaders.ETAG, etag)
        .header(HttpHeaders.CACHE_CONTROL, Domain.CACHEABLE)
        .header("x-rb-serial", Domain.nextSerial());
    if (inm != null && inm.equals(etag)) {
      return ResponseEntity.status(304)
          .header(HttpHeaders.ETAG, etag)
          .header(HttpHeaders.CACHE_CONTROL, Domain.CACHEABLE)
          .header("x-rb-serial", Domain.nextSerial())
          .build();
    }
    return b.body(Domain.payload(size));
  }

  @GetMapping("/cached/small")
  ResponseEntity<Object> small(@RequestHeader(value = "if-none-match", required = false) String i) {
    return serve("small", i);
  }

  @GetMapping("/cached/medium")
  ResponseEntity<Object> medium(@RequestHeader(value = "if-none-match", required = false) String i) {
    return serve("medium", i);
  }

  @GetMapping("/cached/large")
  ResponseEntity<Object> large(@RequestHeader(value = "if-none-match", required = false) String i) {
    return serve("large", i);
  }
}
