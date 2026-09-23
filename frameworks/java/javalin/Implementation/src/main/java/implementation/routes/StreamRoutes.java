package implementation.routes;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

import implementation.Item;
import implementation.Payloads;
import io.javalin.config.JavalinConfig;
import io.javalin.http.Context;
import io.javalin.openapi.OpenApi;
import io.javalin.openapi.OpenApiContent;
import io.javalin.openapi.OpenApiResponse;

/**
 * stream: items.medium's rows written one per line to ctx.outputStream, each flushed as it is
 * written, so the length is never known and the answer goes out chunked.
 */
public final class StreamRoutes {

    private final Payloads p;

    public StreamRoutes(Payloads p) {
        this.p = p;
    }

    public void register(JavalinConfig config) {
        config.routes.get("/stream/items", this::items);
    }

    // ctx.outputStream is Javalin's compressing stream, whose flush does nothing, so each row is
    // flushed through the servlet response under it.
    // rb:handler stream.ndjson
    @OpenApi(path = "/stream/items",
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = Item.class, mimeType = "application/x-ndjson")))
    private void items(Context ctx) throws IOException {
        ctx.contentType("application/x-ndjson");
        OutputStream out = ctx.outputStream();
        for (Item row : p.medium().items()) {
            out.write(ctx.jsonMapper().toJsonString(row, Item.class).getBytes(StandardCharsets.UTF_8));
            out.write('\n');
            ctx.res().flushBuffer();
        }
    }
}
