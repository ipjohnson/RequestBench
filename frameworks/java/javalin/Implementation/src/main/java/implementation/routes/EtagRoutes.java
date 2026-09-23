package implementation.routes;

import implementation.Payload;
import implementation.Payloads;
import implementation.Serial;
import io.javalin.config.JavalinConfig;
import io.javalin.http.Context;
import io.javalin.http.util.ETagGenerator;
import io.javalin.openapi.OpenApi;
import io.javalin.openapi.OpenApiContent;
import io.javalin.openapi.OpenApiResponse;

/**
 * etag: Javalin's ETag generator on these two routes. It reads the body the handler set into an
 * Adler-32 checksum, writes it as the ETag, and answers a matching If-None-Match with 304 in place
 * of the body. The handler runs and the body is built before anything is compared, so a 304 saves
 * the write and nothing else.
 */
public final class EtagRoutes {

    private final Payloads p;

    public EtagRoutes(Payloads p) {
        this.p = p;
    }

    public void register(JavalinConfig config) {
        // config.http.generateEtags runs the generator on every GET answer in the application, so
        // an after handler on /etag/* calls it for these two routes alone. Javalin's writer then
        // answers 304 by comparing the ETag the answer carries with If-None-Match.
        // rb:wiring etag.*
        config.routes.after("/etag/*", ctx -> {
            if (ctx.resultInputStream() != null) {
                ETagGenerator.INSTANCE.tryWriteEtagAndClose(true, ctx, ctx.resultInputStream());
            }
        });
        config.routes.get("/etag/small", this::small);
        config.routes.get("/etag/large", this::large);
    }

    // rb:handler etag.small
    @OpenApi(path = "/etag/small",
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = Payload.class)))
    private void small(Context ctx) {
        Serial.write(ctx);
        ctx.json(p.small());
    }

    // rb:handler etag.large,etag.match_large,etag.stale_large
    @OpenApi(path = "/etag/large",
            responses = {@OpenApiResponse(status = "200", content = @OpenApiContent(from = Payload.class)), @OpenApiResponse(status = "304")})
    private void large(Context ctx) {
        Serial.write(ctx);
        ctx.json(p.large());
    }
}
