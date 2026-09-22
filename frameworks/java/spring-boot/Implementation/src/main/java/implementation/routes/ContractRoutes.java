package implementation.routes;

import java.lang.management.ManagementFactory;

import org.apache.catalina.util.ServerInfo;
import org.springframework.boot.SpringBootVersion;
import org.springframework.boot.web.server.context.WebServerInitializedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.json.JsonMapper;

/** /health and /__meta, which the contract asks of every framework outside the corpus. */
@RestController
public class ContractRoutes {

    /** /__meta: what ran, recorded on the result row and never checked. */
    public record Meta(String framework, String version, String runtime, String adapter, String serializer, Long bootMs) {}

    private final String serializer;

    /** Milliseconds from the start of the JVM to Tomcat listening. */
    private volatile Long bootMs;

    ContractRoutes(JsonMapper json) {
        this.serializer = "Jackson " + json.version();
    }

    @EventListener
    void listening(WebServerInitializedEvent event) {
        bootMs = System.currentTimeMillis() - ManagementFactory.getRuntimeMXBean().getStartTime();
    }

    // The payloads are loaded before Tomcat starts, so a server that answers has them.
    @GetMapping(value = "/health", produces = MediaType.TEXT_PLAIN_VALUE)
    public String health() {
        return "ok";
    }

    @GetMapping("/__meta")
    public Meta meta() {
        return new Meta("Spring Boot", SpringBootVersion.getVersion(), "Java " + Runtime.version(),
                ServerInfo.getServerInfo().replace('/', ' '), serializer, bootMs);
    }
}
