package rb.spring.routes;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import rb.domain.Domain;
import rb.domain.Model.PayloadBody;

/**
 * compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
 *
 * These routes answer with the payload and nothing else. Whether it goes out gzipped is
 * decided by Tomcat's compression, which application.properties turns on for the whole
 * connector.
 */
@RestController
public class Compressed {

  @GetMapping("/compressed/small")
  ResponseEntity<PayloadBody> small() {
    return ResponseEntity.ok().header("x-rb-serial", Domain.nextSerial()).body(Domain.payload("small"));
  }

  @GetMapping("/compressed/medium")
  ResponseEntity<PayloadBody> medium() {
    return ResponseEntity.ok().header("x-rb-serial", Domain.nextSerial()).body(Domain.payload("medium"));
  }

  @GetMapping("/compressed/large")
  ResponseEntity<PayloadBody> large() {
    return ResponseEntity.ok().header("x-rb-serial", Domain.nextSerial()).body(Domain.payload("large"));
  }
}
