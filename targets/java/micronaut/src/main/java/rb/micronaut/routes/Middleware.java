package rb.micronaut.routes;

import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import rb.domain.Domain;
import rb.domain.Model.PayloadBody;

/**
 * middleware: per-layer dispatch cost at 0, 4 and 16 no-op layers.
 *
 * Micronaut's layer is an @Filter, and the annotation takes the patterns it applies to,
 * which is the scoping the family needs. Each layer runs and does nothing else.
 *
 * The layers themselves are in filters/: Micronaut resolves them from annotations at
 * compile time, so one bean is one layer and four and sixteen are written out.
 */
@Controller
public class Middleware {

  @Get("/middleware/none")
  PayloadBody none() {
    return Domain.payload("small");
  }

  // rb:snippet middleware.four
  @Get("/middleware/four")
  PayloadBody four() {
    return Domain.payload("small");
  }

  // rb:snippet middleware.sixteen
  @Get("/middleware/sixteen")
  PayloadBody sixteen() {
    return Domain.payload("small");
  }
}
