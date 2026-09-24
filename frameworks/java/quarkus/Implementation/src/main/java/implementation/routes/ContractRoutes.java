package implementation.routes;

import java.lang.management.ManagementFactory;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.quarkus.runtime.ImageMode;
import io.quarkus.runtime.Quarkus;
import io.quarkus.vertx.http.HttpServerStart;
import io.vertx.core.impl.launcher.commands.VersionCommand;
import jakarta.enterprise.event.ObservesAsync;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

/** /health and /__meta, which the contract asks of every framework outside the corpus. */
@Path("/")
public class ContractRoutes {

    /** /__meta: what ran, recorded on the result row and never checked. */
    public record Meta(String framework, String version, String runtime, String adapter, String serializer, Long bootMs) {}

    private final String serializer;

    /** Milliseconds from the start of the JVM to Vert.x listening. */
    private volatile Long bootMs;

    ContractRoutes(ObjectMapper json) {
        this.serializer = "Jackson " + json.version();
    }

    void listening(@ObservesAsync HttpServerStart event) {
        bootMs = System.currentTimeMillis() - ManagementFactory.getRuntimeMXBean().getStartTime();
    }

    // The payloads are loaded before Quarkus opens its socket, so a server that answers has them.
    @GET
    @Path("health")
    @Produces(MediaType.TEXT_PLAIN)
    public String health() {
        return "ok";
    }

    // A host whose image sets rb.adapter hands the requests to Vert.x through its own adapter, as
    // lambda-emulator's does. Its function is also a native image, whose Runtime.version() is that
    // of the JDK the image was built with.
    @GET
    @Path("__meta")
    public Meta meta() {
        String runtime = "Java " + Runtime.version() + (ImageMode.current() == ImageMode.NATIVE_RUN ? " native image" : "");
        return new Meta("Quarkus", Quarkus.class.getPackage().getImplementationVersion(), runtime,
                System.getProperty("rb.adapter", "Vert.x " + VersionCommand.getVersion()), serializer, bootMs);
    }
}
