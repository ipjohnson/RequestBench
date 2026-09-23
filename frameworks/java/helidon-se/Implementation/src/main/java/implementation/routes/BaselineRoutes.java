package implementation.routes;

import io.helidon.webserver.http.HttpFeature;
import io.helidon.webserver.http.HttpRouting;

/** baseline: the dispatch floor, with nothing serialised. */
public final class BaselineRoutes implements HttpFeature {

    @Override
    public void setup(HttpRouting.Builder routing) {
        routing.get("/plaintext", (req, res) -> res.send("Hello, World!"));
    }
}
