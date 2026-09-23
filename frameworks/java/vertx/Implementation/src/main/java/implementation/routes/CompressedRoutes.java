package implementation.routes;

import implementation.Payloads;
import implementation.Serial;
import io.vertx.ext.web.Router;

/**
 * compressed: these routes answer like any other. The HTTP server's compression, which Server
 * turns on for every connection, gzips the answer when the request asks for it.
 */
public final class CompressedRoutes {

    private CompressedRoutes() {}

    public static void register(Router router, Payloads p) {
        router.get("/compressed/small").handler(ctx -> {
            Serial.write(ctx.response());
            ctx.json(p.small());
        });

        router.get("/compressed/large").handler(ctx -> {
            Serial.write(ctx.response());
            ctx.json(p.large());
        });
    }
}
