package implementation.routes;

import java.net.URI;

import implementation.Item;
import implementation.Payloads;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * items: every method on one resource over the rows of items.large. A measured row may not leave
 * the server changed, so the writes store nothing and answer as if they had written. A missing row
 * raises ResponseStatusException, which Boot's error page answers with 404. Spring MVC answers HEAD
 * from the GET route, and a method the path has no route for with 405.
 */
@RestController
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

    // The GET route answers HEAD too, which its mapping does not say, so it is marked for both.
    // rb:handler items.read,items.head
    // rb:handler errors.not_found
    @GetMapping("/items/{id}")
    public Item read(@PathVariable int id) {
        return row(id);
    }

    @PostMapping("/items")
    public ResponseEntity<Item> create(@RequestBody NewItem item) {
        Item created = item.at(p.large().count() + 1);
        return ResponseEntity.created(URI.create("/items/" + created.id())).body(created);
    }

    @PutMapping("/items/{id}")
    public Item replace(@PathVariable int id, @RequestBody NewItem item) {
        return item.at(id);
    }

    @PatchMapping("/items/{id}")
    public Item update(@PathVariable int id, @RequestBody ItemPatch patch) {
        return patch.onto(row(id));
    }

    @DeleteMapping("/items/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable int id) {
        row(id);
    }

    private Item row(int id) {
        Item row = p.row(id);
        if (row == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        return row;
    }
}
