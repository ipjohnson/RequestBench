package rb.spring.routes;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import rb.domain.Domain;
import rb.hosts.Views;

/**
 * template: server-side rendering of the same model the json family serializes.
 *
 * The engine is jmustache, shared with every other Java target and named on /__meta.
 */
@RestController
public class Templates {

  @GetMapping("/template/small")
  ResponseEntity<String> small() {
    return ResponseEntity.ok().contentType(MediaType.TEXT_HTML)
                         .body(Views.renderItems(Domain.payload("small")));
  }

  @GetMapping("/template/medium")
  ResponseEntity<String> medium() {
    return ResponseEntity.ok().contentType(MediaType.TEXT_HTML)
                         .body(Views.renderItems(Domain.payload("medium")));
  }
}
