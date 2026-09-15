package rb.micronaut.routes;

import io.micronaut.http.annotation.Body;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Post;
import java.util.Map;
import rb.domain.Domain;
import rb.domain.Model.BindResult;
import rb.domain.Model.ValidatedOrder;

/**
 * body: the parser and the validator, with size crossed against validation.
 *
 * Micronaut parses and binds the request body itself, so a body it cannot read fails inside
 * the framework rather than in the domain; Failures turns that into the shared 422.
 *
 * bind parses and binds without validating, so validate minus bind is the validator alone
 * rather than the validator plus the parse.
 */
@Controller
public class BodyRoutes {

  @Post("/body/bind/small")
  BindResult bindSmall(@Body Map<String, Object> body) {
    return Domain.bindEcho(body);
  }

  @Post("/body/bind/medium")
  BindResult bindMedium(@Body Map<String, Object> body) {
    return Domain.bindEcho(body);
  }

  @Post("/body/validate/small")
  ValidatedOrder validateSmall(@Body Map<String, Object> body) {
    return Domain.validateOrder(body);
  }

  @Post("/body/validate/medium")
  ValidatedOrder validateMedium(@Body Map<String, Object> body) {
    return Domain.validateOrder(body);
  }

  @Post("/body/validate/first-error")
  ValidatedOrder validateFirst(@Body Map<String, Object> body) {
    return Domain.validateOrderFirst(body);
  }
}
