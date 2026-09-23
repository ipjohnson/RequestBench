package implementation.routes;

import implementation.Echoed;
import implementation.Payloads;
import implementation.Search;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import io.micronaut.http.annotation.QueryValue;
import io.micronaut.http.annotation.RequestBean;
import io.micronaut.serde.annotation.Serdeable;

/**
 * query: query string values bound by name. /query/one declares its one value on the handler, and
 * /query/many binds all eight into a record through its constructor, as a @RequestBean.
 */
@Controller
public class QueryRoutes {

    @Serdeable
    public record One(int page) {}

    private final Payloads p;

    QueryRoutes(Payloads p) {
        this.p = p;
    }

    @Get("/query/one")
    public Echoed<One> one(@QueryValue int page) {
        return Echoed.of(p.small(), new One(page));
    }

    @Get("/query/many")
    public Echoed<Search> many(@RequestBean Search search) {
        return Echoed.of(p.small(), search);
    }
}
