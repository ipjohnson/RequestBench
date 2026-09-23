package implementation.routes;

import static io.vertx.ext.web.validation.builder.Parameters.param;
import static io.vertx.json.schema.common.dsl.Schemas.intSchema;
import static io.vertx.json.schema.common.dsl.Schemas.stringSchema;

import implementation.Payloads;
import implementation.Validation;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.validation.RequestParameters;
import io.vertx.ext.web.validation.ValidationHandler;
import io.vertx.ext.web.validation.builder.ValidationHandlerBuilder;

/**
 * headers: /headers reads no header, and /headers/bind declares three on a ValidationHandler,
 * the account with an integer schema. The handler copies every request header into a map keyed
 * by its lowercased name before it looks for the three.
 */
public final class HeadersRoutes {

    private HeadersRoutes() {}

    public static void register(Router router, Payloads p) {
        router.get("/headers").handler(ctx -> ctx.json(p.small()));

        router.get("/headers/bind").handler(bound()).handler(ctx -> {
            RequestParameters parsed = Validation.parsed(ctx);
            ctx.json(Payloads.echoed(p.small(), new JsonObject()
                    .put("tenant", parsed.headerParameter("x-rb-tenant").getString())
                    .put("requestId", parsed.headerParameter("x-rb-request-id").getString())
                    .put("account", parsed.headerParameter("x-rb-account").getInteger())));
        });
    }

    // rb:wiring headers.*
    private static ValidationHandler bound() {
        return ValidationHandlerBuilder.create(Validation.repository())
                .headerParameter(param("x-rb-tenant", stringSchema()))
                .headerParameter(param("x-rb-request-id", stringSchema()))
                .headerParameter(param("x-rb-account", intSchema()))
                .build();
    }
}
