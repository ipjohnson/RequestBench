package implementation.routes;

import static io.vertx.ext.web.validation.builder.Parameters.param;
import static io.vertx.json.schema.common.dsl.Schemas.intSchema;

import implementation.Payloads;
import implementation.Validation;
import io.vertx.core.http.HttpHeaders;
import io.vertx.core.http.HttpMethod;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.Router;
import io.vertx.ext.web.RoutingContext;
import io.vertx.ext.web.handler.BodyHandler;
import io.vertx.ext.web.validation.ValidationHandler;
import io.vertx.ext.web.validation.builder.ValidationHandlerBuilder;

/**
 * items: every method on one resource over the rows of items.large, the id bound as an integer by
 * a ValidationHandler as the parameters family binds a capture. A measured row may not leave the
 * server changed, so the writes store nothing and answer as if they had written. A missing row is
 * answered 404 with no body, as Vert.x's REST example answers one. A method the path has no route
 * for gets the router's 405.
 */
public final class ItemsRoutes {

    private ItemsRoutes() {}

    public static void register(Router router, Payloads p) {
        BodyHandler body = BodyHandler.create(false);
        ValidationHandler id = ValidationHandlerBuilder.create(Validation.repository())
                .pathParameter(param("id", intSchema()))
                .build();

        // The route answers HEAD as well as GET, and the handler finder reads GET alone, so it is
        // marked for both. Vert.x writes no body for HEAD.
        // rb:handler items.read,items.head
        // rb:handler errors.not_found
        router.get("/items/:id").method(HttpMethod.HEAD).handler(id).handler(ctx -> {
            JsonObject row = p.row(id(ctx));
            if (row == null) {
                ctx.response().setStatusCode(404).end();
                return;
            }
            ctx.json(row);
        });

        // A payload's "items" key reads as this route's literal, so the route is marked.
        // rb:handler items.create
        router.post("/items").handler(body).handler(ctx -> {
            int created = p.large().getInteger("count") + 1;
            ctx.response().setStatusCode(201).putHeader(HttpHeaders.LOCATION, "/items/" + created);
            ctx.json(new JsonObject().put("id", created).mergeIn(ctx.body().asJsonObject()));
        });

        router.put("/items/:id").handler(body).handler(id)
                .handler(ctx -> ctx.json(new JsonObject().put("id", id(ctx)).mergeIn(ctx.body().asJsonObject())));

        router.patch("/items/:id").handler(body).handler(id).handler(ctx -> {
            JsonObject row = p.row(id(ctx));
            if (row == null) {
                ctx.response().setStatusCode(404).end();
                return;
            }
            ctx.json(row.copy().mergeIn(ctx.body().asJsonObject()));
        });

        router.delete("/items/:id").handler(id).handler(ctx -> ctx.response().setStatusCode(p.row(id(ctx)) == null ? 404 : 204).end());
    }

    private static int id(RoutingContext ctx) {
        return Validation.parsed(ctx).pathParameter("id").getInteger();
    }
}
