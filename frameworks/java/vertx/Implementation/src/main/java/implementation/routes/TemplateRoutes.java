package implementation.routes;

import implementation.Payloads;
import io.vertx.core.Vertx;
import io.vertx.core.http.HttpHeaders;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.RoutingContext;
import io.vertx.ext.web.common.template.TemplateEngine;
import io.vertx.ext.web.templ.handlebars.HandlebarsTemplateEngine;

/**
 * template: Vert.x Web's Handlebars engine, from vertx-web-templ-handlebars, rendering
 * templates/items-page.hbs with the payload as its context. The engine compiles a template on its
 * first render and keeps it in Vert.x's shared data, where every server verticle finds it.
 */
public final class TemplateRoutes {

    private TemplateRoutes() {}

    public static void register(Router router, Vertx vertx, Payloads p) {
        // rb:wiring template.*
        TemplateEngine engine = HandlebarsTemplateEngine.create(vertx);

        router.get("/template/small").handler(ctx -> page(ctx, engine, p.small()));

        router.get("/template/medium").handler(ctx -> page(ctx, engine, p.medium()));
    }

    // rb:wiring template.*
    private static void page(RoutingContext ctx, TemplateEngine engine, JsonObject payload) {
        engine.render(payload, "templates/items-page.hbs")
                .onSuccess(page -> ctx.response().putHeader(HttpHeaders.CONTENT_TYPE, "text/html; charset=utf-8").end(page))
                .onFailure(ctx::fail);
    }
}
