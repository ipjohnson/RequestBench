package rb.micronaut.routes;

import io.micronaut.http.HttpRequest;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import rb.domain.Domain;
import rb.domain.Model.QueryMany;
import rb.domain.Model.QueryOne;
import rb.micronaut.Support;

/**
 * query: query string parsing and coercion, isolated from any use of the values.
 *
 * Micronaut parses request.getParameters(), which is the work this family measures; the
 * domain coerces what it parsed, so every target in the language answers the same values.
 */
@Controller
public class Query {

  @Get("/query/one")
  QueryOne one(HttpRequest<?> request) {
    return Domain.coerceOne(Support.query(request));
  }

  @Get("/query/many")
  QueryMany many(HttpRequest<?> request) {
    return Domain.coerceMany(Support.query(request));
  }
}
