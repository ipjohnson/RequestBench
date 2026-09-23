package implementation.routes;

import implementation.Payloads;
import io.vertx.ext.web.Route;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.RoutingContext;

/**
 * middleware: no-op handlers chained on the route in front of the one that answers, four or
 * sixteen of them. A handler is Vert.x Web's unit of composition, and each layer calls the next
 * and does nothing else.
 */
public final class MiddlewareRoutes {

    private MiddlewareRoutes() {}

    public static void register(Router router, Payloads p) {
        router.get("/middleware/none").handler(ctx -> ctx.json(p.small()));

        layered(router.get("/middleware/four"), 4).handler(ctx -> ctx.json(p.small()));

        layered(router.get("/middleware/sixteen"), 16).handler(ctx -> ctx.json(p.small()));
    }

    // rb:wiring middleware.*
    private static Route layered(Route route, int layers) {
        for (int i = 0; i < layers; i++) {
            route.handler(RoutingContext::next);
        }
        return route;
    }
}
