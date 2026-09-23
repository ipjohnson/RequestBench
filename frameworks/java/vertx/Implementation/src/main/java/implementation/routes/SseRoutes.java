package implementation.routes;

import implementation.Payloads;
import io.vertx.core.http.HttpHeaders;
import io.vertx.core.http.HttpServerResponse;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.Router;

/**
 * sse: items.medium's rows as server-sent events. Vert.x has no support of its own for them, so
 * the handler writes each row as the data of one event, a write of its own on a chunked answer.
 */
public final class SseRoutes {

    private SseRoutes() {}

    public static void register(Router router, Payloads p) {
        router.get("/sse/medium").handler(ctx -> {
            HttpServerResponse response = ctx.response().setChunked(true).putHeader(HttpHeaders.CONTENT_TYPE, "text/event-stream");
            for (Object row : p.medium().getJsonArray("items")) {
                response.write("data: " + ((JsonObject) row).encode() + "\n\n");
            }
            response.end();
        });
    }
}
