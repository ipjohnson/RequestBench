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
 * parameters: router captures, each read with ctx.pathParamAsClass, whose Validator converts it
 * with Javalin's converter for Integer.
 */
public final class ParametersRoutes {

    public record One(int one) {}

    public record Two(int one, int two) {}

    public record Three(int one, int two, int three) {}

    private final Payloads p;

    public ParametersRoutes(Payloads p) {
        this.p = p;
    }

    public void register(JavalinConfig config) {
        // Each route before the captures that match its path too, because Javalin answers with
        // the first route that matches. /parameters/{one}/{two}/{three} matches all three.
        config.routes.get("/parameters/static/segment/literal", this::literal);
        config.routes.get("/parameters/{one}/segment/literal", this::one);
        config.routes.get("/parameters/{one}/with-second/{two}", this::two);
        config.routes.get("/parameters/{one}/{two}/{three}", this::three);
    }

    // rb:handler parameters.static
    @OpenApi(path = "/parameters/static/segment/literal",
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = Payload.class)))
    private void literal(Context ctx) {
        ctx.json(p.small());
    }

    // rb:handler parameters.one
    @OpenApi(path = "/parameters/{one}/segment/literal",
            pathParams = @OpenApiParam(name = "one", type = Integer.class, required = true),
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = Echoed.class)))
    private void one(Context ctx) {
        ctx.json(Echoed.of(p.small(), new One(ctx.pathParamAsClass("one", Integer.class).get())));
    }

    // rb:handler parameters.two
    @OpenApi(path = "/parameters/{one}/with-second/{two}",
            pathParams = {
                @OpenApiParam(name = "one", type = Integer.class, required = true),
                @OpenApiParam(name = "two", type = Integer.class, required = true)},
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = Echoed.class)))
    private void two(Context ctx) {
        ctx.json(Echoed.of(p.small(), new Two(ctx.pathParamAsClass("one", Integer.class).get(), ctx.pathParamAsClass("two", Integer.class).get())));
    }

    // rb:handler parameters.three
    @OpenApi(path = "/parameters/{one}/{two}/{three}",
            pathParams = {
                @OpenApiParam(name = "one", type = Integer.class, required = true),
                @OpenApiParam(name = "two", type = Integer.class, required = true),
                @OpenApiParam(name = "three", type = Integer.class, required = true)},
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = Echoed.class)))
    private void three(Context ctx) {
        int one = ctx.pathParamAsClass("one", Integer.class).get();
        int two = ctx.pathParamAsClass("two", Integer.class).get();
        int three = ctx.pathParamAsClass("three", Integer.class).get();
        ctx.json(Echoed.of(p.small(), new Three(one, two, three)));
    }
}
