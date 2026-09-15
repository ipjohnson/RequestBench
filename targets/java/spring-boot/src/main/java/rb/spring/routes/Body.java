package rb.spring.routes;

import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import rb.domain.Domain;
import rb.domain.Model.BindResult;
import rb.domain.Model.ValidatedOrder;

/**
 * body: the parser and the validator, with size crossed against validation.
 *
 * Spring parses and binds the request body itself, so a body it cannot read fails inside
 * the framework rather than in the domain; Failures turns that into the shared 422.
 *
 * bind parses and binds without validating, so validate minus bind is the validator alone
 * rather than the validator plus the parse.
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
  ValidatedOrder validateSmall(@RequestBody Map<String, Object> body) {
    return Domain.validateOrder(body);
  }

  @PostMapping("/body/validate/medium")
  ValidatedOrder validateMedium(@RequestBody Map<String, Object> body) {
    return Domain.validateOrder(body);
  }

  @PostMapping("/body/validate/first-error")
  ValidatedOrder validateFirst(@RequestBody Map<String, Object> body) {
    return Domain.validateOrderFirst(body);
  }
}
