package rb.micronaut.routes;

import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import io.micronaut.views.View;
import java.util.Map;
import rb.domain.Domain;
import rb.domain.Model.PayloadBody;

/**
 * template: server-side rendering of the same model the json family serializes.
 *
 * Micronaut's own view facility: @View names the template and the method returns the
 * model, so no method here calls a render function. Thymeleaf is the engine Micronaut
 * Views lists first, through micronaut-views-thymeleaf. Parsed on first render and cached
 * by the template engine: a precomputed string would measure nothing.
 *
 * The expressions call the record accessors rather than reading properties, because
 * Thymeleaf outside Spring evaluates with OGNL, which resolves getId() and not id().
 */
@Controller
public class Templates {

  private static Map<String, Object> model(String size) {
    PayloadBody body = Domain.payload(size);
    return Map.of("size", body.size(), "count", body.count(), "items", body.items());
  }

  @View("items")
  @Get("/template/small")
  Map<String, Object> small() {
    return model("small");
  }

  @View("items")
  @Get("/template/medium")
  Map<String, Object> medium() {
    return model("medium");
  }
}
