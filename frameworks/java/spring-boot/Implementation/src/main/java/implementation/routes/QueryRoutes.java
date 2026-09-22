package implementation.routes;

import implementation.Echoed;
import implementation.Payloads;
import implementation.Search;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * query: query string values bound by name. /query/one declares its one value on the handler, and
 * /query/many binds all eight into a record through its constructor, as a @ModelAttribute.
 */
@RestController
public class QueryRoutes {

    public record One(int page) {}

    private final Payloads p;

    QueryRoutes(Payloads p) {
        this.p = p;
    }

    @GetMapping("/query/one")
    public Echoed<One> one(@RequestParam int page) {
        return Echoed.of(p.small(), new One(page));
    }

    @GetMapping("/query/many")
    public Echoed<Search> many(Search search) {
        return Echoed.of(p.small(), search);
    }
}
