package implementation.routes;

import implementation.Payload;
import implementation.Payloads;
import io.helidon.common.media.type.MediaTypes;
import io.helidon.webserver.http.HttpFeature;
import io.helidon.webserver.http.HttpRouting;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

/**
 * template: Helidon SE has no view layer, so the handler renders templates/items-page.html with
 * Thymeleaf's own engine and sends the page. The resolver parses the template once and caches it,
 * and every request renders it.
 */
public final class TemplateRoutes implements HttpFeature {

    private final Payloads p;

    // rb:wiring template.*
    private final TemplateEngine thymeleaf = new TemplateEngine();

    public TemplateRoutes(Payloads p) {
        this.p = p;
        ClassLoaderTemplateResolver templates = new ClassLoaderTemplateResolver();
        templates.setPrefix("templates/");
        templates.setSuffix(".html");
        templates.setTemplateMode(TemplateMode.HTML);
        thymeleaf.setTemplateResolver(templates);
    }
    // rb:end

    @Override
    public void setup(HttpRouting.Builder routing) {
        routing.get("/template/small", (req, res) -> {
            res.headers().contentType(MediaTypes.TEXT_HTML);
            res.send(page(p.small()));
        });

        routing.get("/template/medium", (req, res) -> {
            res.headers().contentType(MediaTypes.TEXT_HTML);
            res.send(page(p.medium()));
        });
    }

    // rb:wiring template.*
    /** templates/items-page.html rendered with the payload as its model. */
    private String page(Payload payload) {
        Context model = new Context();
        model.setVariable("body", payload);
        return thymeleaf.process("items-page", model);
    }
}
