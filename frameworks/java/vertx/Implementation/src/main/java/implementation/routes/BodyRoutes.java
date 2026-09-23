package implementation.routes;

import static io.vertx.json.schema.common.dsl.Keywords.minItems;
import static io.vertx.json.schema.common.dsl.Keywords.minLength;
import static io.vertx.json.schema.common.dsl.Keywords.minimum;
import static io.vertx.json.schema.common.dsl.Schemas.arraySchema;
import static io.vertx.json.schema.common.dsl.Schemas.intSchema;
import static io.vertx.json.schema.common.dsl.Schemas.objectSchema;
import static io.vertx.json.schema.common.dsl.Schemas.stringSchema;

import implementation.Validation;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.RoutingContext;
import io.vertx.ext.web.handler.BodyHandler;
import io.vertx.ext.web.validation.BadRequestException;
import io.vertx.ext.web.validation.ValidationHandler;
import io.vertx.ext.web.validation.builder.Bodies;
import io.vertx.ext.web.validation.builder.ValidationHandlerBuilder;
import io.vertx.json.schema.SchemaRepository;
import io.vertx.json.schema.common.dsl.ArraySchemaBuilder;
import io.vertx.json.schema.common.dsl.NumberSchemaBuilder;
import io.vertx.json.schema.common.dsl.SchemaBuilder;
import io.vertx.json.schema.common.dsl.StringSchemaBuilder;

/**
 * body: the order buffered by BodyHandler on every route. The bind routes parse it with
 * RequestBody.asJsonObject and check nothing. The validate routes mount a ValidationHandler in
 * front of the handler, which parses the body and checks it against orderRequest's rules as a
 * JSON schema, and refuses a body that breaks one with 400.
 */
public final class BodyRoutes {

    // rb:wiring body.*
    // orderRequest's rules, one schema per field. Each schema is named with alias(), so the
    // locations a refusal reports read the same from one start to the next. The DSL otherwise
    // names each schema with a random UUID.
    private static final NumberSchemaBuilder CUSTOMER_ID = intSchema().with(minimum(1)).alias("customerId");

    private static final StringSchemaBuilder STATUS = stringSchema().with(minLength(1)).alias("status");

    private static final ArraySchemaBuilder LINES = arraySchema().with(minItems(1)).items(objectSchema()
            .requiredProperty("productId", intSchema().with(minimum(1)).alias("productId"))
            .requiredProperty("qty", intSchema().with(minimum(1)).alias("qty"))
            .alias("line")).alias("lines");
    // rb:end

    private BodyRoutes() {}

    public static void register(Router router) {
        BodyHandler body = BodyHandler.create(false);
        ValidationHandler order = order(Validation.repository());
        // A repository holds a schema once, so the first-error route's schemas have their own.
        SchemaRepository oneAtATime = Validation.repository();

        router.post("/body/bind/small").handler(body).handler(BodyRoutes::bind);

        router.post("/body/bind/medium").handler(body).handler(BodyRoutes::bind);

        router.post("/body/validate/small").handler(body).handler(order).handler(BodyRoutes::validated);

        router.post("/body/validate/medium").handler(body).handler(order).handler(BodyRoutes::validated);

        router.post("/body/validate/first-error").handler(body)
                .handler(field(oneAtATime, "customerId", CUSTOMER_ID))
                .handler(field(oneAtATime, "status", STATUS))
                .handler(field(oneAtATime, "lines", LINES))
                .handler(BodyRoutes::validated);

        // rb:wiring body.*
        // A ValidationHandler fails the request with 400 and a BadRequestException, which Vert.x
        // Web answers with the status line's text alone. The router's error handler for 400 writes
        // the exception's own toJson(), as vertx-web-validation's documentation suggests.
        router.errorHandler(400, ctx -> {
            if (ctx.failure() instanceof BadRequestException refused) {
                ctx.response().setStatusCode(400);
                ctx.json(refused.toJson());
            }
        });
        // rb:end
    }

    // rb:wiring body.*
    /** Every rule orderRequest states, checked at once. The validator lists each rule the body breaks. */
    private static ValidationHandler order(SchemaRepository schemas) {
        return ValidationHandlerBuilder.create(schemas)
                .body(Bodies.json(objectSchema()
                        .requiredProperty("customerId", CUSTOMER_ID)
                        .requiredProperty("status", STATUS)
                        .requiredProperty("lines", LINES)
                        .alias("orderRequest")))
                .build();
    }

    /**
     * One field's rule, as a ValidationHandler of its own. The first-error route chains one per
     * field in the order orderRequest declares them, and the first that fails stops the route,
     * because the validator has no mode that stops at the first failure and names it.
     */
    private static ValidationHandler field(SchemaRepository schemas, String name, SchemaBuilder<?, ?> rule) {
        return ValidationHandlerBuilder.create(schemas)
                .body(Bodies.json(objectSchema().requiredProperty(name, rule).alias("orderRequest-" + name)))
                .build();
    }
    // rb:end

    private static void bind(RoutingContext ctx) {
        ctx.json(bound(ctx.body().asJsonObject(), ctx));
    }

    private static void validated(RoutingContext ctx) {
        ctx.json(bound(Validation.parsed(ctx).body().getJsonObject(), ctx));
    }

    /**
     * What a bind or validate row answers: the order back, with the leaves the handler found in it,
     * customerId and status and a productId and a qty per line, and the bytes it received.
     */
    private static JsonObject bound(JsonObject order, RoutingContext ctx) {
        return new JsonObject()
                .put("fields", 2 + 2 * order.getJsonArray("lines").size())
                .put("bytes", ctx.body().length())
                .put("echo", order);
    }
}
