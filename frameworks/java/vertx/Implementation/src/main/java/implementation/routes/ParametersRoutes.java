package implementation.routes;

import static io.vertx.ext.web.validation.builder.Parameters.param;
import static io.vertx.json.schema.common.dsl.Schemas.intSchema;

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
 * parameters: router captures, each declared on a ValidationHandler with an integer schema, which
 * parses it before the route's handler reads it back typed. The static route is added first,
 * because Vert.x Web tries routes in order and :one/segment/literal matches its path too.
 */
public final class ParametersRoutes {

    private ParametersRoutes() {}

    public static void register(Router router, Payloads p) {
        SchemaRepository schemas = Validation.repository();

        router.get("/parameters/static/segment/literal").handler(ctx -> ctx.json(p.small()));

        router.get("/parameters/:one/segment/literal").handler(captures(schemas, "one"))
                .handler(ctx -> ctx.json(Payloads.echoed(p.small(), bound(ctx, "one"))));

        router.get("/parameters/:one/with-second/:two").handler(captures(schemas, "one", "two"))
                .handler(ctx -> ctx.json(Payloads.echoed(p.small(), bound(ctx, "one", "two"))));
    }

    // rb:wiring parameters.*
    private static ValidationHandler captures(SchemaRepository schemas, String... names) {
        ValidationHandlerBuilder builder = ValidationHandlerBuilder.create(schemas);
        for (String name : names) {
            builder.pathParameter(param(name, intSchema()));
        }
        return builder.build();
    }

    private static JsonObject bound(RoutingContext ctx, String... names) {
        RequestParameters parsed = Validation.parsed(ctx);
        JsonObject echo = new JsonObject();
        for (String name : names) {
            echo.put(name, parsed.pathParameter(name).getInteger());
        }
        return echo;
    }
    // rb:end
}
