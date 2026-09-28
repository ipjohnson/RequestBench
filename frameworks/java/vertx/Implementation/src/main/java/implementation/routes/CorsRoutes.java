package implementation.routes;

import java.util.regex.Pattern;

import implementation.Payloads;
import implementation.Serial;
import io.vertx.core.http.HttpMethod;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.handler.CorsHandler;

/**
 * cors: Vert.x Web's CorsHandler, on /cors/* and nowhere else. It answers a preflight with 204
 * before any handler runs, so the absence of x-rb-serial on a preflight shows the feature
 * answered alone. It refuses a request from any other origin with 403.
 */
public final class CorsRoutes {

    private CorsRoutes() {}

    public static void register(Router router, Payloads p) {
        // rb:wiring cors.*
        // The origin is given as a pattern that matches it alone. CorsHandler sends Vary: Origin
        // for a pattern, and for a single origin given as a string it sends none.
        router.route("/cors/*").handler(CorsHandler.create()
                .addOriginWithRegex(Pattern.quote("https://shop.example.com"))
                .allowedMethod(HttpMethod.GET)
                .allowedHeader("x-rb-tenant")
                .maxAgeSeconds(600));
        // rb:end

        router.get("/cors/small").handler(ctx -> {
            Serial.write(ctx.response());
            ctx.json(p.small());
        });
    }
}
