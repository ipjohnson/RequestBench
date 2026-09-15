package rb.spring.routes;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import rb.domain.Domain;
import rb.domain.Model.PayloadBody;

/**
 * json: the serializer and response buffering across three size regimes.
 *
 * Three static routes, not /json/{size}. The size set is fixed, so a capture would make the
 * router pay parameter cost on the family every other target serves from a static route.
 */
@RestController
public class JsonRoutes {

  @GetMapping("/json/small")
  PayloadBody small() {
    return Domain.payload("small");
  }

  @GetMapping("/json/medium")
  PayloadBody medium() {
    return Domain.payload("medium");
  }

  @GetMapping("/json/large")
  PayloadBody large() {
    return Domain.payload("large");
  }
}
