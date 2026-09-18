package rb.spring.routes;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import rb.domain.Domain;
import rb.domain.Model.PayloadWithEcho;
import rb.domain.Model.QueryMany;
import rb.domain.Model.QueryOne;

/**
 * query: query string parsing, percent-decoding and coercion, with the values echoed beside the
 * small payload and put to no other use.
 *
 * Spring's own binding: @RequestParam names the parameter and declares its type, and Spring
 * converts what the router parsed before the method runs. defaultValue is what an absent one
 * is; a value the converter refuses is a MethodArgumentTypeMismatchException, which is
 * Spring's own 400 and not this repository's.
 */
@RestController
public class Query {

  @GetMapping("/query/one")
  PayloadWithEcho one(@RequestParam(name = "page", defaultValue = "0") int page) {
    return Domain.withEcho("small", new QueryOne(page));
  }

  @GetMapping("/query/many")
  PayloadWithEcho many(@RequestParam(name = "page", defaultValue = "0") int page,
                       @RequestParam(name = "size", defaultValue = "0") int size,
                       @RequestParam(name = "status", defaultValue = "") String status,
                       @RequestParam(name = "category", defaultValue = "") String category,
                       @RequestParam(name = "sort", defaultValue = "") String sort,
                       @RequestParam(name = "q", defaultValue = "") String q,
                       @RequestParam(name = "min_price", defaultValue = "0") int minPrice,
                       @RequestParam(name = "max_price", defaultValue = "0") int maxPrice) {
    return Domain.withEcho("small",
        new QueryMany(page, size, status, category, sort, q, minPrice, maxPrice));
  }
}
