package implementation.routes;

import java.lang.management.ManagementFactory;

import io.helidon.common.Version;
import io.helidon.json.binding.Json;
import io.helidon.webserver.WebServer;
import io.helidon.webserver.http.HttpFeature;
import io.helidon.webserver.http.HttpRouting;

/** /health and /__meta, which the contract asks of every framework outside the corpus. */
public final class ContractRoutes implements HttpFeature {

    /** /__meta: what ran, recorded on the result row and never checked. */
    @Json.Entity
    public record Meta(String framework, String version, String runtime, String adapter, String serializer, Long bootMs) {}

    /** Milliseconds from the start of the JVM to the server listening. */
    private volatile Long bootMs;

    @Override
    public void setup(HttpRouting.Builder routing) {
        // The payloads are loaded before the server starts, so a server that answers has them.
        routing.get("/health", (req, res) -> res.send("ok"));

        routing.get("/__meta", (req, res) -> res.send(new Meta("Helidon SE", Version.VERSION, "Java " + Runtime.version(),
                "Helidon WebServer " + Version.VERSION, "Helidon JSON Binding " + Version.VERSION, bootMs)));
    }

    @Override
    public void afterStart(WebServer server) {
        bootMs = System.currentTimeMillis() - ManagementFactory.getRuntimeMXBean().getStartTime();
    }
}
