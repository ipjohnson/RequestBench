package rb.spring.routes;

import java.util.Map;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import rb.domain.Domain;
import rb.domain.Model.BindResult;
import rb.domain.Model.ValidatedOrder;
import rb.spring.OrderIn;

/**
 * body: the parser and the validator, with size crossed against validation.
 *
 * Spring parses and binds the request body itself, so a body it cannot read fails inside
 * the framework rather than in a handler.
 *
 * bind parses and binds without validating, so validate minus bind is the validator alone
 * rather than the validator plus the parse. @Valid on the parameter is the whole wiring for
 * validate: Spring runs Bean Validation before the method is entered.
 */
@RestController
public class Body {

  @PostMapping("/body/bind/small")
  BindResult bindSmall(@RequestBody Map<String, Object> body) {
    return Domain.bindEcho(body);
  }

  @PostMapping("/body/bind/medium")
  BindResult bindMedium(@RequestBody Map<String, Object> body) {
    return Domain.bindEcho(body);
  }

  @PostMapping("/body/validate/small")
  ValidatedOrder validateSmall(@Valid @RequestBody OrderIn body) {
    return body.order();
  }

  @PostMapping("/body/validate/medium")
  ValidatedOrder validateMedium(@Valid @RequestBody OrderIn body) {
    return body.order();
  }

  /**
   * Hibernate Validator reports every constraint that failed and offers no way to stop at
   * the first without configuring a fail-fast ValidatorFactory for the whole application,
   * which would change this endpoint's neighbour too. So this row answers what Spring
   * answers, and the gap to body.rejected_all is what Spring costs rather than the same
   * walk written twice.
   */
  @PostMapping("/body/validate/first-error")
  ValidatedOrder validateFirst(@Valid @RequestBody OrderIn body) {
    return body.order();
  }
}
