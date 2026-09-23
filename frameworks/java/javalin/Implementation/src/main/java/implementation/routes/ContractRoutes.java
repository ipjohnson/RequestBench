package implementation.routes;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.lang.management.ManagementFactory;
import java.util.Properties;

import com.fasterxml.jackson.databind.cfg.PackageVersion;
import io.javalin.Javalin;
import io.javalin.config.JavalinConfig;
import io.javalin.http.Context;
import io.javalin.openapi.OpenApi;
import io.javalin.openapi.OpenApiContent;
import io.javalin.openapi.OpenApiResponse;
import org.eclipse.jetty.util.Jetty;

/** /health and /__meta, which the contract asks of every framework outside the corpus. */
public final class ContractRoutes {

    /** /__meta: what ran, recorded on the result row and never checked. */
    public record Meta(String framework, String version, String runtime, String adapter, String serializer, Long bootMs) {}

    private final String version = javalinVersion();

    /** Milliseconds from the start of the JVM to Jetty listening. */
    private volatile Long bootMs;

    public void register(JavalinConfig config) {
        config.events.serverStarted(() -> bootMs = System.currentTimeMillis() - ManagementFactory.getRuntimeMXBean().getStartTime());
        config.routes.get("/health", this::health);
        config.routes.get("/__meta", this::meta);
    }

    // The payloads are loaded before Javalin starts, so a server that answers has them.
    @OpenApi(path = "/health",
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = String.class, mimeType = "text/plain")))
    private void health(Context ctx) {
        ctx.result("ok");
    }

    @OpenApi(path = "/__meta",
            responses = @OpenApiResponse(status = "200", content = @OpenApiContent(from = Meta.class)))
    private void meta(Context ctx) {
        ctx.json(new Meta("Javalin", version, "Java " + Runtime.version(), "Jetty " + Jetty.VERSION, "Jackson " + PackageVersion.VERSION, bootMs));
    }

    /** The version Javalin's own jar records, which Javalin reads to log the version it runs. */
    private static String javalinVersion() {
        try (InputStream in = Javalin.class.getResourceAsStream("/META-INF/maven/io.javalin/javalin/pom.properties")) {
            Properties properties = new Properties();
            properties.load(in);
            return properties.getProperty("version");
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
