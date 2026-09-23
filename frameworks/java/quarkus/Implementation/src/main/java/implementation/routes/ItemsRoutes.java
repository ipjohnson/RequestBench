package implementation.routes;

import implementation.Item;
import implementation.Payloads;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.core.UriInfo;
import org.jboss.resteasy.reactive.RestPath;
import org.jboss.resteasy.reactive.RestResponse;

/**
 * items: every method on one resource over the rows of items.large. A measured row may not leave
 * the server changed, so the writes store nothing and answer as if they had written. A missing row
 * raises Jakarta REST's NotFoundException, which Quarkus REST answers with 404. Jakarta REST
 * answers HEAD from the GET method, and a method the path has no resource method for with 405.
 */
@Path("/items")
public class ItemsRoutes {

    /** An item as a client creates or replaces one. */
    public record NewItem(String name, String category, int priceCents, boolean inStock) {

        Item at(int id) {
            return new Item(id, name, category, priceCents, inStock);
        }
    }

    /** The two fields items.update changes. */
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

    // The GET method answers HEAD too, which its annotations do not say, so it is marked for both.
    // rb:handler items.read,items.head
    // rb:handler errors.not_found
    @GET
    @Path("{id}")
    public Item read(@RestPath int id) {
        return row(id);
    }

    // rb:handler items.create
    @POST
    public RestResponse<Item> create(NewItem item, UriInfo uri) {
        Item created = item.at(p.large().count() + 1);
        return RestResponse.ResponseBuilder.<Item>created(uri.getAbsolutePathBuilder().path(Integer.toString(created.id())).build())
                .entity(created)
                .build();
    }

    // rb:handler items.replace
    @PUT
    @Path("{id}")
    public Item replace(@RestPath int id, NewItem item) {
        return item.at(id);
    }

    // rb:handler items.update
    @PATCH
    @Path("{id}")
    public Item update(@RestPath int id, ItemPatch patch) {
        return patch.onto(row(id));
    }

    // rb:handler items.delete
    @DELETE
    @Path("{id}")
    public void delete(@RestPath int id) {
        row(id);
    }

    private Item row(int id) {
        Item row = p.row(id);
        if (row == null) {
            throw new NotFoundException();
        }
        return row;
    }
}
