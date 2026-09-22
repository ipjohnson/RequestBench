package implementation.routes;

import implementation.Payload;
import implementation.Payloads;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * template: Spring MVC's view resolution with Thymeleaf. A handler returns a view name, and
 * Thymeleaf's view resolver finds templates/items-page.html and renders it with the model. A
 * @Controller rather than a @RestController, which would write the returned name as the body.
 */
@Controller
public class TemplateRoutes {

    private final Payloads p;

    TemplateRoutes(Payloads p) {
        this.p = p;
    }

    @GetMapping("/template/small")
    public String small(Model model) {
        return page(model, p.small());
    }

    @GetMapping("/template/medium")
    public String medium(Model model) {
        return page(model, p.medium());
    }

    // rb:wiring template.*
    /** The view name Thymeleaf's view resolver finds as templates/items-page.html, and its model. */
    private static String page(Model model, Payload payload) {
        model.addAttribute("body", payload);
        return "items-page";
    }
}
