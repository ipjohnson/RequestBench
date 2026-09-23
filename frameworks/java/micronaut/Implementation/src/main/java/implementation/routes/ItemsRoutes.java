package implementation.routes;

import java.net.URI;

import implementation.Item;
import implementation.Payloads;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.MediaType;
import io.micronaut.http.annotation.Body;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Delete;
import io.micronaut.http.annotation.Get;
import io.micronaut.http.annotation.Patch;
import io.micronaut.http.annotation.PathVariable;
import io.micronaut.http.annotation.Post;
import io.micronaut.http.annotation.Put;
import io.micronaut.serde.annotation.Serdeable;

/**
 * items: every method on one resource over the rows of items.large. A measured row may not leave
 * the server changed, so the writes store nothing and answer as if they had written. A handler
 * that finds no row returns null, which Micronaut answers with 404. @Get registers a HEAD route
 * beside the GET, and the router answers a method the path has no route for with 405.
 */
@Controller
public class ItemsRoutes {

    /** An item as a client creates or replaces one. */
    @Serdeable
    public record NewItem(String name, String category, int priceCents, boolean inStock) {

        Item at(int id) {
            return new Item(id, name, category, priceCents, inStock);
        }
    }

    /** The two fields items.update changes. */
    @Serdeable
    public record ItemPatch(Integer priceCents, Boolean inStock) {

        Item onto(Item row) {
            return new Item(row.id(), row.name(), row.category(),
                    priceCents == null ? row.priceCents() : priceCents,
                    inStock == null ? row.inStock() : inStock);
        }
    }

    private final Payloads p;

    ItemsRoutes(Payloads p) {
        this.p = p;
    }

    // The GET route answers HEAD too, which its mapping does not say, so it is marked for both.
    // Micronaut drops a HEAD answer's body before it chooses a content type, so the handler names
    // the type itself.
    // rb:handler items.read,items.head
    // rb:handler errors.not_found
    @Get("/items/{id}")
    public HttpResponse<Item> read(@PathVariable int id) {
        Item row = p.row(id);
        return row == null ? null : HttpResponse.ok(row).contentType(MediaType.APPLICATION_JSON_TYPE);
    }

    @Post("/items")
    public HttpResponse<Item> create(@Body NewItem item) {
        Item created = item.at(p.large().count() + 1);
        return HttpResponse.created(created, URI.create("/items/" + created.id()));
    }

    @Put("/items/{id}")
    public Item replace(@PathVariable int id, @Body NewItem item) {
        return item.at(id);
    }

    @Patch("/items/{id}")
    public Item update(@PathVariable int id, @Body ItemPatch patch) {
        Item row = p.row(id);
        return row == null ? null : patch.onto(row);
    }

    @Delete("/items/{id}")
    public HttpResponse<Void> delete(@PathVariable int id) {
        return p.row(id) == null ? HttpResponse.notFound() : HttpResponse.noContent();
    }
}
