package rb.spring.routes;

import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import rb.hosts.Hosts;

/** baseline: dispatch floor, no serialization. */
@RestController
public class Baseline {

  // The content type is set on the response rather than with `produces`, which would
  // restrict matching: the gate sends Accept: application/json on every request, and a
  // text/plain-only route does not match it at all.
  @GetMapping("/plaintext")
  ResponseEntity<String> plaintext() {
    return ResponseEntity.ok().contentType(MediaType.TEXT_PLAIN).body("Hello, World!");
  }

  @GetMapping("/health")
  ResponseEntity<String> health() {
    return ResponseEntity.ok().contentType(MediaType.TEXT_PLAIN).body("ok");
  }

  @GetMapping("/__meta")
  Map<String, String> meta() {
    return Hosts.meta("spring-boot", Hosts.version("spring-boot"));
  }
}
