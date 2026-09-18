package rb.spring.routes;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import rb.domain.Domain;
import rb.domain.Model.PayloadBody;
import rb.domain.Model.PayloadWithEcho;

/**
 * parameters: router captures with segment depth held constant.
 *
 * Spring's own binding: @PathVariable names the capture and declares its type, and Spring
 * converts it before the method runs. The static route needs no ordering to win over
 * {one}/segment/literal, because Spring prefers the pattern with fewer captures.
 */
@RestController
public class Parameters {

  record One(int one) {}

  record Two(int one, int two) {}

  @GetMapping("/parameters/static/segment/literal")
  PayloadBody staticPath() {
    return Domain.payload("small");
  }

  @GetMapping("/parameters/{one}/segment/literal")
  PayloadWithEcho one(@PathVariable("one") int one) {
    return Domain.withEcho("small", new One(one));
  }

  @GetMapping("/parameters/{one}/with-second/{two}")
  PayloadWithEcho two(@PathVariable("one") int one, @PathVariable("two") int two) {
    return Domain.withEcho("small", new Two(one, two));
  }
}
