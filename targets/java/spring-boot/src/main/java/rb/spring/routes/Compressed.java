package rb.spring.routes;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;
import rb.domain.Domain;
import rb.domain.Json;

/**
 * compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
 *
 * Spring Boot's server.compression setting is on the whole connector, which would put a
 * "did the client ask?" check on all forty-five endpoints and contaminate the rows this
 * family is measured against. These three routes carry it instead, with the codec pinned
 * across every language.
 */
@RestController
public class Compressed {

  // rb:wiring compressed.*
  /** The floor Spring Boot's own connector compression defaults to. */
  private static final int THRESHOLD = 2048;

  // rb:wiring compressed.*
  private static ResponseEntity<byte[]> serve(String size, String accept) {
    byte[] raw = Json.bytes(Domain.payload(size));
    boolean wanted = accept != null && accept.contains("gzip") && raw.length >= THRESHOLD;
    byte[] out = wanted ? Domain.gzip(raw) : raw;
    ResponseEntity.BodyBuilder b = ResponseEntity.ok()
        .contentType(MediaType.APPLICATION_JSON)
        .header("x-rb-serial", Domain.nextSerial());
    if (wanted) {
      b.header(HttpHeaders.CONTENT_ENCODING, "gzip").header(HttpHeaders.VARY, "Accept-Encoding");
    }
    return b.body(out);
  }

  @GetMapping("/compressed/small")
  ResponseEntity<byte[]> small(@RequestHeader(value = "accept-encoding", required = false) String a) {
    return serve("small", a);
  }

  @GetMapping("/compressed/medium")
  ResponseEntity<byte[]> medium(@RequestHeader(value = "accept-encoding", required = false) String a) {
    return serve("medium", a);
  }

  @GetMapping("/compressed/large")
  ResponseEntity<byte[]> large(@RequestHeader(value = "accept-encoding", required = false) String a) {
    return serve("large", a);
  }
}
