package implementation.routes;

import implementation.Item;
import implementation.Payloads;
import io.javalin.config.JavalinConfig;
import io.javalin.http.Context;
import io.javalin.http.Header;
import io.javalin.http.HttpStatus;
import io.javalin.http.NotFoundResponse;
import io.javalin.openapi.HttpMethod;
import io.javalin.openapi.OpenApi;
import io.javalin.openapi.OpenApiContent;
import io.javalin.openapi.OpenApiParam;
import io.javalin.openapi.OpenApiRequestBody;
import io.javalin.openapi.OpenApiResponse;

/**
 * items: every method on one resource over the rows of items.large. A measured row may not leave
 * the server changed, so the writes store nothing and answer as if they had written. A missing row
 * throws NotFoundResponse, which Javalin answers with 404.
 */
public final class ItemsRoutes {

    /** An item as a client creates or replaces one. */
    public record NewItem(String name, String category, int priceCents, boolean inStock) {}

    /** The two fields items.update changes. */
    public record ItemPatch(Integer priceCents, Boolean inStock) {}

    private final Payloads p;

    public ItemsRoutes(Payloads p) {
        this.p = p;
    }

    public void register(JavalinConfig config) {
        config.routes.get("/items/{id}", this::read);
        // Javalin answers HEAD on a path with a GET route itself, with 200, no body and its default
        // text/plain type, and without running the GET route. This route runs it for HEAD too.
        config.routes.head("/items/{id}", this::read);
        config.routes.post("/items", this::create);
        config.routes.put("/items/{id}", this::replace);
        config.routes.patch("/items/{id}", this::update);
        config.routes.delete("/items/{id}", this::delete);
    }

    // rb:handler items.read,items.head,errors.not_found
    @OpenApi(path = "/items/{id}",
            methods = HttpMethod.GET,
            pathParams = @OpenApiParam(name = "id", type = Integer.class, required = true),
            responses = {@OpenApiResponse(status = "200", content = @OpenApiContent(from = Item.class)), @OpenApiResponse(status = "404")})
    @OpenApi(path = "/items/{id}",
            methods = HttpMethod.HEAD,
            pathParams = @OpenApiParam(name = "id", type = Integer.class, required = true),
            responses = {@OpenApiResponse(status = "200"), @OpenApiResponse(status = "404")})
    private void read(Context ctx) {
        ctx.json(row(ctx));
    }

    // rb:handler items.create
    @OpenApi(path = "/items",
            methods = HttpMethod.POST,
            requestBody = @OpenApiRequestBody(content = @OpenApiContent(from = NewItem.class), required = true),
            responses = @OpenApiResponse(status = "201", content = @OpenApiContent(from = Item.class)))
    private void create(Context ctx) {
        Item created = numbered(ctx.bodyAsClass(NewItem.class), p.large().count() + 1);
        ctx.status(HttpStatus.CREATED).header(Header.LOCATION, "/items/" + created.id()).json(created);
    }

    // rb:handler items.replace
    @OpenApi(path = "/items/{id}",
            methods = HttpMethod.PUT,
            pathParams = @OpenApiParam(name = "id", type = Integer.class, required = true),
            requestBody = @OpenApiRequestBody(content = @OpenApiContent(from = NewItem.class), required = true),
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = Item.class)))
    private void replace(Context ctx) {
        ctx.json(numbered(ctx.bodyAsClass(NewItem.class), ctx.pathParamAsClass("id", Integer.class).get()));
    }

    // rb:handler items.update
    @OpenApi(path = "/items/{id}",
            methods = HttpMethod.PATCH,
            pathParams = @OpenApiParam(name = "id", type = Integer.class, required = true),
            requestBody = @OpenApiRequestBody(content = @OpenApiContent(from = ItemPatch.class), required = true),
            responses = {@OpenApiResponse(status = "200", content = @OpenApiContent(from = Item.class)), @OpenApiResponse(status = "404")})
    private void update(Context ctx) {
        ctx.json(patched(ctx.bodyAsClass(ItemPatch.class), row(ctx)));
    }

    // rb:handler items.delete
    @OpenApi(path = "/items/{id}",
            methods = HttpMethod.DELETE,
            pathParams = @OpenApiParam(name = "id", type = Integer.class, required = true),
            responses = {@OpenApiResponse(status = "204"), @OpenApiResponse(status = "404")})
    private void delete(Context ctx) {
        row(ctx);
        ctx.status(HttpStatus.NO_CONTENT);
    }

    private static Item numbered(NewItem item, int id) {
        return new Item(id, item.name(), item.category(), item.priceCents(), item.inStock());
    }

    private static Item patched(ItemPatch patch, Item row) {
        return new Item(row.id(), row.name(), row.category(),
                patch.priceCents() == null ? row.priceCents() : patch.priceCents(),
                patch.inStock() == null ? row.inStock() : patch.inStock());
    }

    private Item row(Context ctx) {
        Item row = p.row(ctx.pathParamAsClass("id", Integer.class).get());
        if (row == null) {
            throw new NotFoundResponse();
        }
        return row;
    }
}
