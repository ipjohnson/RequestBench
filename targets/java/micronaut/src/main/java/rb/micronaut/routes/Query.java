package rb.micronaut.routes;

import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import io.micronaut.http.annotation.QueryValue;
import rb.domain.Domain;
import rb.domain.Model.PayloadWithEcho;
import rb.domain.Model.QueryMany;
import rb.domain.Model.QueryOne;

/**
 * query: query string parsing, percent-decoding and coercion, with the values echoed beside the
 * small payload and put to no other use.
 *
 * Micronaut's own binding: @QueryValue names the parameter and declares its type, and the
 * conversion service converts what the router parsed before the method runs. defaultValue is
 * what an absent one is; a value the conversion service refuses is a ConversionErrorException,
 * which is Micronaut's own 400 and not this repository's.
 */
@Controller
public class Query {

  @Get("/query/one")
  PayloadWithEcho one(@QueryValue(value = "page", defaultValue = "0") int page) {
    return Domain.withEcho("small", new QueryOne(page));
  }

  @Get("/query/many")
  PayloadWithEcho many(@QueryValue(value = "page", defaultValue = "0") int page,
                       @QueryValue(value = "size", defaultValue = "0") int size,
                       @QueryValue(value = "status", defaultValue = "") String status,
                       @QueryValue(value = "category", defaultValue = "") String category,
                       @QueryValue(value = "sort", defaultValue = "") String sort,
                       @QueryValue(value = "q", defaultValue = "") String q,
                       @QueryValue(value = "min_price", defaultValue = "0") int minPrice,
                       @QueryValue(value = "max_price", defaultValue = "0") int maxPrice) {
    return Domain.withEcho("small",
        new QueryMany(page, size, status, category, sort, q, minPrice, maxPrice));
  }
}
