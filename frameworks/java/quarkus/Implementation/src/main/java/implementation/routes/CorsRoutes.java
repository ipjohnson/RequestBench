package implementation.routes;

import implementation.Payload;
import implementation.Payloads;
import implementation.Serial;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import org.jboss.resteasy.reactive.RestResponse;

/**
 * cors: Quarkus's CORS filter, configured in application.properties. The filter runs before routing
 * on every path. It answers a preflight before any handler runs, so the absence of x-rb-serial on a
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

}
