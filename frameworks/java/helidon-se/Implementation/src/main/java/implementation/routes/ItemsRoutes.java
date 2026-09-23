package implementation.routes;

import implementation.Item;
import implementation.Payloads;
import io.helidon.common.media.type.MediaTypes;
import io.helidon.http.HeaderNames;
import io.helidon.http.NotFoundException;
import io.helidon.http.Status;
import io.helidon.json.binding.Json;
import io.helidon.webserver.http.HttpFeature;
import io.helidon.webserver.http.HttpRouting;
import io.helidon.webserver.http.ServerRequest;

/**
 * items: every method on one resource over the rows of items.large. A measured row may not leave
 * the server changed, so the writes store nothing and answer as if they had written. A missing row
 * throws NotFoundException, which Helidon answers with 404. Helidon matches the method and the path
 * together, so a method the path has no route for is the router's 404 too.
 */
public final class ItemsRoutes implements HttpFeature {

    /** An item as a client creates or replaces one. */
    @Json.Entity
    public record NewItem(String name, String category, int priceCents, boolean inStock) {

        Item at(int id) {
            return new Item(id, name, category, priceCents, inStock);
        }
    }

    /** The two fields items.update changes. */
    @Json.Entity
    public record ItemPatch(Integer priceCents, Boolean inStock) {

        Item onto(Item row) {
            return new Item(row.id(), row.name(), row.category(),
                    priceCents == null ? row.priceCents() : priceCents,
                    inStock == null ? row.inStock() : inStock);
        }
    }

    private final Payloads p;

    public ItemsRoutes(Payloads p) {
        this.p = p;
    }

    @Override
    public void setup(HttpRouting.Builder routing) {
        // The snippet finder reads no method from the HEAD route's line, so that line matches every
        // route on the path, and each of them is marked.
        // rb:handler items.read,errors.not_found
        routing.get("/items/{id}", (req, res) -> res.send(row(req)));

        // Helidon answers HEAD only where a route names it, and writes any body a handler sends.
        // rb:handler items.head
        routing.head("/items/{id}", (req, res) -> {
            row(req);
            res.headers().contentType(MediaTypes.APPLICATION_JSON);
            res.send();
        });

        routing.post("/items", (req, res) -> {
            Item created = req.content().as(NewItem.class).at(p.large().count() + 1);
            res.status(Status.CREATED_201).header(HeaderNames.LOCATION, "/items/" + created.id()).send(created);
        });

        // rb:handler items.replace
        routing.put("/items/{id}", (req, res) -> res.send(req.content().as(NewItem.class).at(id(req))));

        // rb:handler items.update
        routing.patch("/items/{id}", (req, res) -> res.send(req.content().as(ItemPatch.class).onto(row(req))));

        // rb:handler items.delete
        routing.delete("/items/{id}", (req, res) -> {
            row(req);
            res.status(Status.NO_CONTENT_204).send();
        });
    }

    private static int id(ServerRequest req) {
        return req.path().pathParameters().first("id").asInt().get();
    }

    private Item row(ServerRequest req) {
        Item row = p.row(id(req));
        if (row == null) {
            throw new NotFoundException("No item has id " + id(req));
        }
        return row;
    }
}
