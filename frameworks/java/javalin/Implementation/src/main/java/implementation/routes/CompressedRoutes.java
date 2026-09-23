package implementation.routes;

import implementation.Payload;
import implementation.Payloads;
import implementation.Serial;
import io.javalin.config.JavalinConfig;
import io.javalin.http.Context;
import io.javalin.openapi.OpenApi;
import io.javalin.openapi.OpenApiContent;
import io.javalin.openapi.OpenApiResponse;

/**
 * compressed: these routes answer like any other. Javalin's compression, which Application sets for
 * the whole application, gzips the answer when the request asks for it.
 */
public final class CompressedRoutes {

    private final Payloads p;

    public CompressedRoutes(Payloads p) {
        this.p = p;
    }

    public void register(JavalinConfig config) {
        config.routes.get("/compressed/small", this::small);
        config.routes.get("/compressed/large", this::large);
    }

    // rb:handler compressed.gzip_small,compressed.identity_small
    @OpenApi(path = "/compressed/small",
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = Payload.class)))
    private void small(Context ctx) {
        Serial.write(ctx);
        ctx.json(p.small());
    }

    // rb:handler compressed.gzip_large,compressed.identity_large
    @OpenApi(path = "/compressed/large",
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = Payload.class)))
    private void large(Context ctx) {
        Serial.write(ctx);
        ctx.json(p.large());
    }
}
