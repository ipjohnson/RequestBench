package implementation.routes;

import java.lang.management.ManagementFactory;

import com.fasterxml.jackson.core.json.PackageVersion;
import io.netty.util.Version;
import io.vertx.core.http.HttpHeaders;
import io.vertx.core.internal.VertxInternal;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.Router;

/** /health and /__meta, which the contract asks of every framework outside the corpus. */
public final class ContractRoutes {

    /** Milliseconds from the start of the JVM to every server verticle listening. */
    private static volatile Long bootMs;

    private ContractRoutes() {}

    public static void listening() {
        bootMs = System.currentTimeMillis() - ManagementFactory.getRuntimeMXBean().getStartTime();
    }

    public static void register(Router router) {
        // The payloads are loaded before any server is deployed, so a server that answers has them.
        router.get("/health").handler(ctx -> ctx.response().putHeader(HttpHeaders.CONTENT_TYPE, "text/plain").end("ok"));

        // /__meta: what ran, recorded on the result row and never checked. Vert.x keeps its
        // version in a resource that VertxInternal reads, and has no public accessor for it.
        router.get("/__meta").handler(ctx -> ctx.json(new JsonObject()
                .put("framework", "Vert.x Web")
                .put("version", VertxInternal.version())
                .put("runtime", "Java " + Runtime.version())
                .put("adapter", "Netty " + Version.identify().get("netty-codec-http").artifactVersion())
                .put("serializer", "Jackson " + PackageVersion.VERSION)
                .put("bootMs", bootMs)));
    }
}
