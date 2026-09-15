package rb.micronaut.routes;

import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import rb.domain.Domain;
import rb.domain.Model.PayloadBody;

/**
 * json: the serializer and response buffering across three size regimes.
 *
 * Three static routes, not /json/{size}. The size set is fixed, so a capture would make the
 * router pay parameter cost on the family every other target serves from a static route.
 */
@Controller
public class JsonRoutes {

  @Get("/json/small")
  PayloadBody small() {
    return Domain.payload("small");
  }

  @Get("/json/medium")
  PayloadBody medium() {
    return Domain.payload("medium");
  }

  @Get("/json/large")
  PayloadBody large() {
    return Domain.payload("large");
  }
}
