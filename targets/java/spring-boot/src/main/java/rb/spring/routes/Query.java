package rb.spring.routes;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import rb.domain.Domain;
import rb.domain.Model.QueryMany;
import rb.domain.Model.QueryOne;
import rb.spring.Support;

/**
 * query: query string parsing and coercion, isolated from any use of the values.
 *
 * Spring parses the query string into the @RequestParam map, which is the work this family
 * measures; the domain coerces what it parsed, so every target in the language answers the
 * same values.
 */
@RestController
public class Query {

  @GetMapping("/query/one")
  QueryOne one(@RequestParam Map<String, String> q) {
    return Domain.coerceOne(Support.query(q));
  }

  @GetMapping("/query/many")
  QueryMany many(@RequestParam Map<String, String> q) {
    return Domain.coerceMany(Support.query(q));
  }
}
