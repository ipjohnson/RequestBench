package rb.micronaut.routes;

import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import rb.domain.Domain;
import rb.domain.Model.PayloadBody;

/** parameters: router captures with segment depth held constant. */
@Controller
public class Parameters {

  @Get("/parameters/static/segment/literal")
  PayloadBody staticPath() {
    return Domain.payload("small");
  }

  @Get("/parameters/{one}")
  PayloadBody one(String one) {
    return Domain.payload("small");
  }

  @Get("/parameters/{one}/with-second/{two}")
  PayloadBody two(String one, String two) {
    return Domain.payload("small");
  }
}
