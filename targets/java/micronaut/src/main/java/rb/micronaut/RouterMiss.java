package rb.micronaut;

import io.micronaut.http.HttpRequest;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.HttpStatus;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Error;
import rb.domain.Domain;

/** The 404 an unmatched path gets. It is a status rather than an exception, which is why
 * it is an @Error hook and not an ExceptionHandler. */
@Controller
public class RouterMiss {

  // rb:snippet errors.unmatched
  @Error(global = true, status = HttpStatus.NOT_FOUND)
  public HttpResponse<Object> unmatched(HttpRequest<?> request) {
    return HttpResponse.notFound(Domain.notFoundBody());
  }
}
