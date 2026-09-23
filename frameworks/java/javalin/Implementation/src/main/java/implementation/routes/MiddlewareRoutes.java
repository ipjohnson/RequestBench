package implementation.routes;

import implementation.Payload;
import implementation.Payloads;
import io.javalin.config.JavalinConfig;
import io.javalin.http.Context;
import io.javalin.openapi.OpenApi;
import io.javalin.openapi.OpenApiContent;
import io.javalin.openapi.OpenApiResponse;

/**
 * middleware: no-op before handlers in front of the handler, four or sixteen of them, each
 * registered for its one path. Javalin runs a request's before handlers one after another, so a
 * layer that does nothing is a before handler with an empty body.
 */
public final class MiddlewareRoutes {

    private final Payloads p;

    public MiddlewareRoutes(Payloads p) {
        this.p = p;
    }

    public void register(JavalinConfig config) {
        config.routes.get("/middleware/none", this::none);
        layers(config, "/middleware/four", 4);
        config.routes.get("/middleware/four", this::four);
        layers(config, "/middleware/sixteen", 16);
        config.routes.get("/middleware/sixteen", this::sixteen);
    }

    // rb:wiring middleware.*
    private static void layers(JavalinConfig config, String path, int count) {
        for (int i = 0; i < count; i++) {
            config.routes.before(path, ctx -> { });
        }
    }

    // rb:handler middleware.none
    @OpenApi(path = "/middleware/none",
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = Payload.class)))
    private void none(Context ctx) {
        ctx.json(p.small());
    }

    // rb:handler middleware.four
    @OpenApi(path = "/middleware/four",
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = Payload.class)))
    private void four(Context ctx) {
        ctx.json(p.small());
    }

    // rb:handler middleware.sixteen
    @OpenApi(path = "/middleware/sixteen",
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = Payload.class)))
    private void sixteen(Context ctx) {
        ctx.json(p.small());
    }
}
