package implementation.routes;

import implementation.Echoed;
import implementation.Payloads;
import implementation.Search;
import io.javalin.config.JavalinConfig;
import io.javalin.http.Context;
import io.javalin.openapi.OpenApi;
import io.javalin.openapi.OpenApiContent;
import io.javalin.openapi.OpenApiParam;
import io.javalin.openapi.OpenApiResponse;

/**
 * query: query string values read by name with ctx.queryParamAsClass, whose Validator converts
 * each with Javalin's converter for its type. /query/many reads all eight into a record.
 */
public final class QueryRoutes {

    public record One(int page) {}

    private final Payloads p;

    public QueryRoutes(Payloads p) {
        this.p = p;
    }

    public void register(JavalinConfig config) {
        config.routes.get("/query/one", this::one);
        config.routes.get("/query/many", this::many);
    }

    // rb:handler query.one
    @OpenApi(path = "/query/one",
            queryParams = @OpenApiParam(name = "page", type = Integer.class, required = true),
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = Echoed.class)))
    private void one(Context ctx) {
        ctx.json(Echoed.of(p.small(), new One(ctx.queryParamAsClass("page", Integer.class).get())));
    }

    // rb:handler query.many
    @OpenApi(path = "/query/many",
            queryParams = {
                @OpenApiParam(name = "page", type = Integer.class, required = true),
                @OpenApiParam(name = "size", type = Integer.class, required = true),
                @OpenApiParam(name = "status", required = true),
                @OpenApiParam(name = "category", required = true),
                @OpenApiParam(name = "sort", required = true),
                @OpenApiParam(name = "q", required = true),
                @OpenApiParam(name = "minPrice", type = Integer.class, required = true),
                @OpenApiParam(name = "maxPrice", type = Integer.class, required = true)},
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = Echoed.class)))
    private void many(Context ctx) {
        ctx.json(Echoed.of(p.small(), Search.bind(ctx::queryParamAsClass)));
    }
}
