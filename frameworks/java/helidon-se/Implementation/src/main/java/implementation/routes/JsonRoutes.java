package implementation.routes;

import implementation.Payloads;
import io.helidon.webserver.http.HttpFeature;
import io.helidon.webserver.http.HttpRouting;

/**
 * json: a payload the framework already holds, serialised at three sizes by Helidon JSON Binding,
 * the media support that writes a record a handler sends.
 */
public final class JsonRoutes implements HttpFeature {

    private final Payloads p;

    public JsonRoutes(Payloads p) {
        this.p = p;
    }

    @Override
    public void setup(HttpRouting.Builder routing) {
        routing.get("/json/small", (req, res) -> res.send(p.small()));

        routing.get("/json/medium", (req, res) -> res.send(p.medium()));

        routing.get("/json/large", (req, res) -> res.send(p.large()));
    }
}
