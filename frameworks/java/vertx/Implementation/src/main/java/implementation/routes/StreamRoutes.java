package implementation.routes;

import implementation.Payloads;
import io.vertx.core.http.HttpHeaders;
import io.vertx.core.http.HttpServerResponse;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.Router;

/**
 * stream: items.medium's rows written one per line on a chunked answer, each row a write of its
 * own. The length is never known, so no Content-Length goes out.
 */
public final class StreamRoutes {

    private StreamRoutes() {}

    public static void register(Router router, Payloads p) {
        router.get("/stream/items").handler(ctx -> {
            HttpServerResponse response = ctx.response().setChunked(true).putHeader(HttpHeaders.CONTENT_TYPE, "application/x-ndjson");
            for (Object row : p.medium().getJsonArray("items")) {
                response.write(((JsonObject) row).toBuffer().appendString("\n"));
            }
            response.end();
        });
    }
}
