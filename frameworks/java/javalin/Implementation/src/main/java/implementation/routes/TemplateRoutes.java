package implementation.routes;

import java.util.Map;

import implementation.Payload;
import implementation.Payloads;
import io.javalin.config.JavalinConfig;
import io.javalin.http.Context;
import io.javalin.openapi.OpenApi;
import io.javalin.openapi.OpenApiContent;
import io.javalin.openapi.OpenApiResponse;
import io.javalin.rendering.template.JavalinMustache;

/**
 * template: Javalin's rendering, with Mustache, the engine in the example on Javalin's rendering
 * page. ctx.render hands the template and the model to the file renderer, and writes the page as
 * text/html. mustache.java compiles the template on the first render and keeps it.
 */
public final class TemplateRoutes {

    private static final String PAGE = "templates/items-page.mustache";

    private final Payloads p;

    public TemplateRoutes(Payloads p) {
        this.p = p;
    }

    public void register(JavalinConfig config) {
        // rb:wiring template.*
        config.fileRenderer(new JavalinMustache());
        config.routes.get("/template/small", this::small);
        config.routes.get("/template/medium", this::medium);
    }

    // rb:handler template.small
    @OpenApi(path = "/template/small",
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = String.class, mimeType = "text/html")))
    private void small(Context ctx) {
        ctx.render(PAGE, model(p.small()));
    }

    // rb:handler template.medium
    @OpenApi(path = "/template/medium",
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = String.class, mimeType = "text/html")))
    private void medium(Context ctx) {
        ctx.render(PAGE, model(p.medium()));
    }

    private static Map<String, Object> model(Payload payload) {
        return Map.of("size", payload.size(), "count", payload.count(), "items", payload.items());
    }
}
