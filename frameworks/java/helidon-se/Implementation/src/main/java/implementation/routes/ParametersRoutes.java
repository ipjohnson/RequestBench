package implementation.routes;

import implementation.Echoed;
import implementation.Payloads;
import io.helidon.json.binding.Json;
import io.helidon.webserver.http.HttpFeature;
import io.helidon.webserver.http.HttpRouting;
import io.helidon.webserver.http.ServerRequest;

/**
 * parameters: router captures, each read by name from the matched path's parameters and converted
 * by Helidon's mapper to the integer asInt asks for. The literal route is registered first,
 * because Helidon tries routes in the order they were registered and the capture matches its path
 * too.
 */
public final class ParametersRoutes implements HttpFeature {

    @Json.Entity
    public record One(int one) {}

    @Json.Entity
    public record Two(int one, int two) {}

    private final Payloads p;

    public ParametersRoutes(Payloads p) {
        this.p = p;
    }

    @Override
    public void setup(HttpRouting.Builder routing) {
        routing.get("/parameters/static/segment/literal", (req, res) -> res.send(p.small()));

        routing.get("/parameters/{one}/segment/literal", (req, res) -> res.send(Echoed.of(p.small(), new One(capture(req, "one")))));

        routing.get("/parameters/{one}/with-second/{two}", (req, res) ->
                res.send(Echoed.of(p.small(), new Two(capture(req, "one"), capture(req, "two")))));
    }

    private static int capture(ServerRequest req, String name) {
        return req.path().pathParameters().first(name).asInt().get();
    }
}
