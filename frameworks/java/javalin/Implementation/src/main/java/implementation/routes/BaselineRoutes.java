package implementation.routes;

import io.javalin.config.JavalinConfig;
import io.javalin.http.Context;
import io.javalin.openapi.OpenApi;
import io.javalin.openapi.OpenApiContent;
import io.javalin.openapi.OpenApiResponse;

/** baseline: the dispatch floor, with nothing serialised. */
public final class BaselineRoutes {

    public void register(JavalinConfig config) {
        config.routes.get("/plaintext", this::plaintext);
    }

    // rb:handler baseline.plaintext
    @OpenApi(path = "/plaintext",
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = String.class, mimeType = "text/plain")))
    private void plaintext(Context ctx) {
        ctx.result("Hello, World!");
    }
}
