package implementation.routes;

import implementation.Payloads;
import io.vertx.ext.web.Router;

/**
 * json: a payload the framework already holds, serialised at three sizes by RoutingContext.json,
 * which encodes a JsonObject with Jackson's streaming generator.
 */
public final class JsonRoutes {

    private JsonRoutes() {}

    public static void register(Router router, Payloads p) {
        router.get("/json/small").handler(ctx -> ctx.json(p.small()));

        router.get("/json/medium").handler(ctx -> ctx.json(p.medium()));

        router.get("/json/large").handler(ctx -> ctx.json(p.large()));
    }
}
