package rb.micronaut.filters;

import io.micronaut.http.HttpRequest;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.HttpStatus;
import io.micronaut.http.annotation.ServerFilter;
import io.micronaut.http.annotation.RequestFilter;
import rb.domain.Domain;

/**
 * authorized: the framework's authorization mechanism, crypto excluded.
 *
 * An @Filter bound to this path, not an if in the handler. A filter refuses a request by
 * returning a response instead of nothing.
 *
 * Top level rather than nested inside the controller: Micronaut's processor builds a bean
 * definition per @Filter class, and one nested in a @Controller is built against an
 * enclosing instance it has no way to supply, which surfaced as a 500 on every filtered
 * route.
 */
@ServerFilter("/authorized/small")
public class RequireToken {

  // @Nullable because returning nothing is how a filter says carry on, and Micronaut
  // rejects a null return without it.
  @RequestFilter
  @io.micronaut.core.annotation.Nullable
  public HttpResponse<?> check(HttpRequest<?> request) {
    if (Domain.tokenOk(request.getHeaders().get("authorization"))) {
      return null;
    }
    return HttpResponse.status(HttpStatus.FORBIDDEN).body(Domain.forbiddenBody());
  }
}
