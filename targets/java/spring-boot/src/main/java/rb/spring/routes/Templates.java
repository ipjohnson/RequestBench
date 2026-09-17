package rb.spring.routes;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import rb.domain.Domain;
import rb.domain.Model.PayloadBody;

/**
 * template: server-side rendering of the same model the json family serializes.
 *
 * Spring MVC's own view resolution: a @Controller returns a view name, the resolver finds
 * the template and renders it. Thymeleaf is the engine, because spring-boot-starter-thymeleaf
 * is what Spring's own "Serving Web Content with Spring MVC" guide adds. Parsed on first
 * render and cached by the template resolver: a precomputed string would measure nothing.
 *
 * This is a @Controller rather than a @RestController, because @RestController implies
 * @ResponseBody and the returned String would be written as the body instead of resolved
 * as a view name.
 */
@Controller
public class Templates {

  // rb:wiring template.*
  private static String render(Model model, String size) {
    PayloadBody body = Domain.payload(size);
    model.addAttribute("size", body.size());
    model.addAttribute("count", body.count());
    model.addAttribute("items", body.items());
    return "items";
  }

  @GetMapping("/template/small")
  String small(Model model) {
    return render(model, "small");
  }

  @GetMapping("/template/medium")
  String medium(Model model) {
    return render(model, "medium");
  }
}
