package rb.micronaut.routes;

import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import rb.domain.Domain;
import rb.domain.Model.PayloadBody;

/**
 * authorized: the framework's authorization mechanism, crypto excluded.
 *
 * The check is an @Filter bound to this path, in filters/RequireToken, not an if in the
 * handler. An if would measure the language; the point of the family is the framework's own
 * plumbing.
 */
@Controller
public class Authorized {

  // rb:handler authorized.*
  @Get("/authorized/small")
  PayloadBody small() {
    return Domain.payload("small");
  }
}
