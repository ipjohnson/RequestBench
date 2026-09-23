package implementation.routes;

import implementation.Echoed;
import implementation.Payloads;
import io.helidon.http.HeaderName;
import io.helidon.http.HeaderNames;
import io.helidon.http.ServerRequestHeaders;
import io.helidon.json.binding.Json;
import io.helidon.webserver.http.HttpFeature;
import io.helidon.webserver.http.HttpRouting;

/**
 * headers: /headers reads no header, and /headers/bind reads three from the request's headers by
 * name, the account converted to an integer by Helidon's mapper.
 */
public final class HeadersRoutes implements HttpFeature {

    @Json.Entity
    public record Bound(String tenant, String requestId, int account) {}

    private static final HeaderName TENANT = HeaderNames.create("x-rb-tenant");

    private static final HeaderName REQUEST_ID = HeaderNames.create("x-rb-request-id");

    private static final HeaderName ACCOUNT = HeaderNames.create("x-rb-account");

    private final Payloads p;

    public HeadersRoutes(Payloads p) {
        this.p = p;
    }

    @Override
    public void setup(HttpRouting.Builder routing) {
        routing.get("/headers", (req, res) -> res.send(p.small()));

        routing.get("/headers/bind", (req, res) -> {
            ServerRequestHeaders headers = req.headers();
            res.send(Echoed.of(p.small(), new Bound(headers.get(TENANT).get(), headers.get(REQUEST_ID).get(), headers.get(ACCOUNT).asInt().get())));
        });
    }
}
