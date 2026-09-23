package implementation.routes;

import implementation.Payload;
import implementation.Payloads;
import io.javalin.config.JavalinConfig;
import io.javalin.http.Context;
import io.javalin.openapi.OpenApi;
import io.javalin.openapi.OpenApiContent;
import io.javalin.openapi.OpenApiResponse;

/**
 * json: a payload the framework already holds, serialised at three sizes by ctx.json, which
 * writes it with Javalin's JSON mapper, Jackson by default.
 */
public final class JsonRoutes {

    private final Payloads p;

    public JsonRoutes(Payloads p) {
        this.p = p;
    }

    public void register(JavalinConfig config) {
        config.routes.get("/json/small", this::small);
        config.routes.get("/json/medium", this::medium);
        config.routes.get("/json/large", this::large);
    }

    // The CORS rule is on /cors/* alone, so this route answers the allowed origin with no policy.
    // rb:handler json.small,cors.scoped
    @OpenApi(path = "/json/small",
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = Payload.class)))
    private void small(Context ctx) {
        ctx.json(p.small());
    }

    // rb:handler json.medium
    @OpenApi(path = "/json/medium",
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = Payload.class)))
    private void medium(Context ctx) {
        ctx.json(p.medium());
    }

    // rb:handler json.large
    @OpenApi(path = "/json/large",
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = Payload.class)))
    private void large(Context ctx) {
        ctx.json(p.large());
    }
}
