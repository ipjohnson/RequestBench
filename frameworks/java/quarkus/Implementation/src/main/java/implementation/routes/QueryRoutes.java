package implementation.routes;

import implementation.Echoed;
import implementation.Payloads;
import jakarta.ws.rs.BeanParam;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import org.jboss.resteasy.reactive.RestQuery;

/**
 * query: query string values bound by name. /query/one declares its one value on the handler, and
 * /query/many binds all eight into a record whose components each name one, as a @BeanParam.
 */
@Path("/query")
public class QueryRoutes {

    public record One(int page) {}

    /** query.many's eight values. */
    public record Search(@RestQuery int page, @RestQuery int size, @RestQuery String status, @RestQuery String category,
                         @RestQuery String sort, @RestQuery String q, @RestQuery int minPrice, @RestQuery int maxPrice) {}

    private final Payloads p;

    QueryRoutes(Payloads p) {
        this.p = p;
    }

    // rb:handler query.one
    @GET
    @Path("one")
    public Echoed<One> one(@RestQuery int page) {
        return Echoed.of(p.small(), new One(page));
    }

    // rb:handler query.many
    @GET
    @Path("many")
    public Echoed<Search> many(@BeanParam Search search) {
        return Echoed.of(p.small(), search);
    }
}
