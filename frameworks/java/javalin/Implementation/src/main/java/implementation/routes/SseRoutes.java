package implementation.routes;

import implementation.Item;
import implementation.Payloads;
import io.javalin.config.JavalinConfig;
import io.javalin.http.sse.SseClient;
import io.javalin.openapi.OpenApi;
import io.javalin.openapi.OpenApiContent;
import io.javalin.openapi.OpenApiResponse;

/**
 * sse: items.medium's rows as server-sent events, through config.routes.sse. Javalin hands the
 * handler an SseClient on its async executor, and sendData writes each row with the JSON mapper
 * as the data of one event with no event name, and flushes it.
 */
public final class SseRoutes {

    private final Payloads p;

    public SseRoutes(Payloads p) {
        this.p = p;
    }

    public void register(JavalinConfig config) {
        config.routes.sse("/sse/medium", this::medium);
    }

    // rb:handler sse.medium
    @OpenApi(path = "/sse/medium",
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = Item.class, mimeType = "text/event-stream")))
    private void medium(SseClient client) {
        for (Item row : p.medium().items()) {
            client.sendData(row);
        }
    }
}
