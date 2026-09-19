package rb.micronaut.routes;

import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import io.micronaut.http.annotation.PathVariable;
import io.micronaut.serde.annotation.Serdeable;
import rb.domain.Domain;
import rb.domain.Model.PayloadBody;
import rb.domain.Model.PayloadWithEcho;

/**
 * parameters: router captures with segment depth held constant.
 *
 * Micronaut's own binding: @PathVariable names the capture and declares its type, and the
 * conversion service converts it before the method runs. The static route needs no ordering
 * to win over {one}/segment/literal, because Micronaut prefers the route with fewer
 * variables.
 */
@Controller
public class Parameters {

  @Serdeable
  record One(int one) {}

  @Serdeable
  record Two(int one, int two) {}

  @Get("/parameters/static/segment/literal")
  PayloadBody staticPath() {
    return Domain.payload("small");
  }

  @Get("/parameters/{one}/segment/literal")
  PayloadWithEcho one(@PathVariable("one") int one) {
    return Domain.withEcho("small", new One(one));
  }

  @Get("/parameters/{one}/with-second/{two}")
  PayloadWithEcho two(@PathVariable("one") int one, @PathVariable("two") int two) {
    return Domain.withEcho("small", new Two(one, two));
  }
}
