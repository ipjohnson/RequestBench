package rb.spring.routes;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import rb.domain.Domain;
import rb.domain.Model.PayloadBody;

/** parameters: router captures with segment depth held constant. */
@RestController
public class Parameters {

  @GetMapping("/parameters/static/segment/literal")
  PayloadBody staticPath() {
    return Domain.payload("small");
  }

  @GetMapping("/parameters/{one}")
  PayloadBody one() {
    return Domain.payload("small");
  }

  @GetMapping("/parameters/{one}/with-second/{two}")
  PayloadBody two() {
    return Domain.payload("small");
  }
}
