package implementation.routes;

import java.util.Arrays;

import implementation.Payloads;
import io.helidon.webserver.http.Handler;
import io.helidon.webserver.http.HttpFeature;
import io.helidon.webserver.http.HttpRouting;

/**
 * middleware: no-op routes in front of the handler, four or sixteen of them, each registered for
 * its one path. A route that calls res.next() is how Helidon filters a single path, and Helidon
 * tries a request's routes in the order they were registered, so the layers come first.
 */
public final class MiddlewareRoutes implements HttpFeature {

    private final Payloads p;

    public MiddlewareRoutes(Payloads p) {
        this.p = p;
    }

    @Override
    public void setup(HttpRouting.Builder routing) {
        routing.get("/middleware/none", (req, res) -> res.send(p.small()));

        // rb:wiring middleware.*
        routing.any("/middleware/four", layers(4));
        routing.any("/middleware/sixteen", layers(16));
        // rb:end

        // The layers above name these two paths too, so the handlers are marked.
        // rb:handler middleware.four
        routing.get("/middleware/four", (req, res) -> res.send(p.small()));

        // rb:handler middleware.sixteen
        routing.get("/middleware/sixteen", (req, res) -> res.send(p.small()));
    }

    // rb:wiring middleware.*
    /** Each layer is a route of its own: it passes the request to the next route and does nothing else. */
    private static Handler[] layers(int count) {
        Handler[] layers = new Handler[count];
        Arrays.fill(layers, (Handler) (req, res) -> res.next());
        return layers;
    }
}
