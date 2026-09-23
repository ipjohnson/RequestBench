package implementation.routes;

import implementation.Payload;
import implementation.Payloads;
import implementation.Serial;
import implementation.Settings;
import io.javalin.config.JavalinConfig;
import io.javalin.http.Context;
import io.javalin.openapi.OpenApi;
import io.javalin.openapi.OpenApiContent;
import io.javalin.openapi.OpenApiResponse;

/**
 * cors: Javalin's bundled CORS plugin, with one rule whose path is /cors/*. The plugin registers a
 * before handler and an after handler for that path. The before handler writes the headers, and
 * for a preflight, which no route answers, the after handler turns the router's 404 into 200, so
 * the absence of x-rb-serial on a preflight shows the plugin answered alone.
 */
public final class CorsRoutes {

    private final Payloads p;

    public CorsRoutes(Payloads p) {
        this.p = p;
    }

    public void register(JavalinConfig config) {
        Settings.Cors cors = p.settings().cors();
        // The plugin has no list of methods or headers. It answers a preflight from an allowed origin
        // with the method and the headers the preflight asked for.
        // rb:handler cors.disallowed
        // rb:wiring cors.*
        config.bundledPlugins.enableCors(plugin -> plugin.addRule(rule -> {
            rule.path = "/cors/*";
            rule.allowHost(cors.origin());
            rule.maxAge = cors.maxAgeSeconds();
        }));
        config.routes.get("/cors/small", this::small);
    }

    // rb:handler cors.request,cors.vary
    @OpenApi(path = "/cors/small",
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = Payload.class)))
    private void small(Context ctx) {
        Serial.write(ctx);
        ctx.json(p.small());
    }
}
