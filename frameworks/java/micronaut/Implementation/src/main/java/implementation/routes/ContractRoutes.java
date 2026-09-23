package implementation.routes;

import java.lang.management.ManagementFactory;

import io.micronaut.core.version.VersionUtils;
import io.micronaut.http.MediaType;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import io.micronaut.runtime.event.annotation.EventListener;
import io.micronaut.runtime.server.event.ServerStartupEvent;
import io.micronaut.serde.annotation.Serdeable;
import io.netty.util.Version;
import tools.jackson.core.json.PackageVersion;

/** /health and /__meta, which the contract asks of every framework outside the corpus. */
@Controller
public class ContractRoutes {

    /** /__meta: what ran, recorded on the result row and never checked. */
    @Serdeable
    public record Meta(String framework, String version, String runtime, String adapter, String serializer, Long bootMs) {}

    /** Every Netty jar carries the same version. */
    private static final String ADAPTER = "Netty " + Version.identify().values().iterator().next().artifactVersion();

    /** Micronaut Serialization reads and writes JSON through jackson-core's parser and generator. */
    private static final String SERIALIZER = "Micronaut Serialization on jackson-core " + PackageVersion.VERSION;

    /** Milliseconds from the start of the JVM to Netty listening. */
    private volatile Long bootMs;

    @EventListener
    void listening(ServerStartupEvent event) {
        bootMs = System.currentTimeMillis() - ManagementFactory.getRuntimeMXBean().getStartTime();
    }

    // The payloads are loaded before Netty starts, so a server that answers has them.
    @Get(value = "/health", produces = MediaType.TEXT_PLAIN)
    public String health() {
        return "ok";
    }

    @Get("/__meta")
    public Meta meta() {
        return new Meta("Micronaut", VersionUtils.getMicronautVersion(), "Java " + Runtime.version(), ADAPTER, SERIALIZER, bootMs);
    }
}
