package implementation.routes;

import java.time.Duration;

import implementation.Payload;
import implementation.Payloads;
import implementation.Serial;
import implementation.Settings;
import io.quarkus.vertx.http.security.CORS;
import io.quarkus.vertx.http.security.HttpSecurity;
import jakarta.enterprise.event.Observes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import org.jboss.resteasy.reactive.RestResponse;

/**
 * cors: Quarkus's CORS filter, configured from settings.json through the HttpSecurity event, which
 * Quarkus fires once its runtime configuration is ready. The filter runs before routing on every
 * path. It answers a preflight before any handler runs, so the absence of x-rb-serial on a
 * preflight shows the feature answered alone. It adds Vary: Origin to every answer to a request
 * that names an origin.
 */
@Path("/cors")
public class CorsRoutes {

    private final Payloads p;

    CorsRoutes(Payloads p) {
        this.p = p;
    }

    // rb:handler cors.request
    @GET
    @Path("small")
    public RestResponse<Payload> small() {
        return RestResponse.ResponseBuilder.ok(p.small()).header(Serial.HEADER, Serial.next()).build();
    }

    // rb:wiring cors.*
    void policy(@Observes HttpSecurity http) {
        Settings.Cors cors = p.settings().cors();
        http.cors(CORS.builder()
                .origin(cors.origin())
                .method(cors.method())
                .header(cors.header())
                .accessControlMaxAge(Duration.ofSeconds(cors.maxAgeSeconds()))
                .build());
    }
}
