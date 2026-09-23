package implementation.routes;

import implementation.Echoed;
import implementation.Payloads;
import implementation.Search;
import io.helidon.json.binding.Json;
import io.helidon.webserver.http.HttpFeature;
import io.helidon.webserver.http.HttpRouting;

/**
 * query: query string values read by name from the request's parsed query, the numbers converted
 * by Helidon's mapper. /query/many reads all eight into query.many's record.
 */
public final class QueryRoutes implements HttpFeature {

    @Json.Entity
    public record Page(int page) {}

    private final Payloads p;

    public QueryRoutes(Payloads p) {
        this.p = p;
    }

    @Override
    public void setup(HttpRouting.Builder routing) {
        routing.get("/query/one", (req, res) -> res.send(Echoed.of(p.small(), new Page(req.query().first("page").asInt().get()))));

        routing.get("/query/many", (req, res) -> res.send(Echoed.of(p.small(), Search.of(req.query()))));
    }
}
