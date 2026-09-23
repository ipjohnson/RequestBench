package implementation.routes;

import static io.vertx.ext.web.validation.builder.Parameters.param;
import static io.vertx.json.schema.common.dsl.Schemas.intSchema;
import static io.vertx.json.schema.common.dsl.Schemas.stringSchema;

import java.util.List;
import java.util.Set;

import implementation.Payloads;
import implementation.Validation;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.RoutingContext;
import io.vertx.ext.web.validation.RequestParameters;
import io.vertx.ext.web.validation.ValidationHandler;
import io.vertx.ext.web.validation.builder.ValidationHandlerBuilder;
import io.vertx.json.schema.SchemaRepository;

/**
 * query: query string values declared on a ValidationHandler, which reads them from the query
 * string Vert.x decoded, parses each to its schema's type, and hands the route's handler the
 * typed values.
 */
public final class QueryRoutes {

    /** query.many's eight values, which forms.urlencoded posts as a form. */
    static final List<String> SEARCH = List.of("page", "size", "status", "category", "sort", "q", "minPrice", "maxPrice");

    /** The ones that bind as integers. */
    static final Set<String> NUMBERS = Set.of("page", "size", "minPrice", "maxPrice");

    private QueryRoutes() {}

    public static void register(Router router, Payloads p) {
        SchemaRepository schemas = Validation.repository();

        router.get("/query/one").handler(query(schemas, List.of("page")))
                .handler(ctx -> ctx.json(Payloads.echoed(p.small(), bound(ctx, List.of("page")))));

        router.get("/query/many").handler(query(schemas, SEARCH))
                .handler(ctx -> ctx.json(Payloads.echoed(p.small(), bound(ctx, SEARCH))));
    }

    // rb:wiring query.*
    private static ValidationHandler query(SchemaRepository schemas, List<String> names) {
        ValidationHandlerBuilder builder = ValidationHandlerBuilder.create(schemas);
        for (String name : names) {
            builder.queryParameter(NUMBERS.contains(name) ? param(name, intSchema()) : param(name, stringSchema()));
        }
        return builder.build();
    }

    private static JsonObject bound(RoutingContext ctx, List<String> names) {
        RequestParameters parsed = Validation.parsed(ctx);
        JsonObject echo = new JsonObject();
        for (String name : names) {
            echo.put(name, parsed.queryParameter(name).get());
        }
        return echo;
    }
    // rb:end
}
