package implementation.routes;

import io.vertx.core.http.HttpHeaders;
import io.vertx.ext.web.Router;

/** baseline: the dispatch floor, with nothing serialised. */
public final class BaselineRoutes {

    private BaselineRoutes() {}

    public static void register(Router router) {
        router.get("/plaintext").handler(ctx -> ctx.response().putHeader(HttpHeaders.CONTENT_TYPE, "text/plain").end("Hello, World!"));
    }
}
