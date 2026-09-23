package implementation.routes;

import implementation.Echoed;
import implementation.Payload;
import implementation.Payloads;
import io.javalin.config.JavalinConfig;
import io.javalin.http.Context;
import io.javalin.openapi.OpenApi;
import io.javalin.openapi.OpenApiContent;
import io.javalin.openapi.OpenApiParam;
import io.javalin.openapi.OpenApiResponse;

/**
 * headers: /headers reads no header, and /headers/bind reads three with ctx.headerAsClass, whose
 * Validator converts the account with Javalin's converter for Integer.
 */
public final class HeadersRoutes {

    public record Bound(String tenant, String requestId, int account) {}

    private final Payloads p;

    public HeadersRoutes(Payloads p) {
        this.p = p;
    }

    public void register(JavalinConfig config) {
        config.routes.get("/headers", this::headers);
        config.routes.get("/headers/bind", this::bind);
    }

    // rb:handler headers.few,headers.many
    @OpenApi(path = "/headers",
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = Payload.class)))
    private void headers(Context ctx) {
        ctx.json(p.small());
    }

    // rb:handler headers.bind_few,headers.bind_many
    @OpenApi(path = "/headers/bind",
            headers = {
                @OpenApiParam(name = "x-rb-tenant", required = true),
                @OpenApiParam(name = "x-rb-request-id", required = true),
                @OpenApiParam(name = "x-rb-account", type = Integer.class, required = true)},
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = Echoed.class)))
    private void bind(Context ctx) {
        ctx.json(Echoed.of(p.small(), new Bound(
                ctx.headerAsClass("x-rb-tenant", String.class).get(),
                ctx.headerAsClass("x-rb-request-id", String.class).get(),
                ctx.headerAsClass("x-rb-account", Integer.class).get())));
    }
}
