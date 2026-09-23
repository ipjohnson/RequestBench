package implementation.routes;

import implementation.Payload;
import implementation.Payloads;
import io.micronaut.http.MediaType;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import io.micronaut.views.ModelAndView;

/**
 * template: Micronaut Views with Thymeleaf. A handler returns a ModelAndView, and micronaut-views'
 * body writer has Thymeleaf render views/items-page.html with the payload's properties as the
 * model.
 */
@Controller
public class TemplateRoutes {

    private final Payloads p;

    TemplateRoutes(Payloads p) {
        this.p = p;
    }

    @Get(value = "/template/small", produces = MediaType.TEXT_HTML)
    public ModelAndView<Payload> small() {
        return page(p.small());
    }

    @Get(value = "/template/medium", produces = MediaType.TEXT_HTML)
    public ModelAndView<Payload> medium() {
        return page(p.medium());
    }

    // rb:wiring template.*
    /** The view Thymeleaf finds as views/items-page.html, and its model. */
    private static ModelAndView<Payload> page(Payload payload) {
        return new ModelAndView<>("items-page", payload);
    }
}
