package implementation.routes;

import implementation.Payload;
import implementation.Payloads;
import implementation.Serial;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import org.jboss.resteasy.reactive.RestResponse;

/**
 * compressed: these routes answer like any other. Quarkus's compression, which
 * application.properties turns on for the whole HTTP server, gzips the answer when the request asks
 * for it.
 */
@Path("/compressed")
public class CompressedRoutes {

    private final Payloads p;

    CompressedRoutes(Payloads p) {
        this.p = p;
    }

    // rb:handler compressed.identity_small,compressed.gzip_small
    @GET
    @Path("small")
    public RestResponse<Payload> small() {
        return RestResponse.ResponseBuilder.ok(p.small()).header(Serial.HEADER, Serial.next()).build();
    }

    // rb:handler compressed.identity_large,compressed.gzip_large
    @GET
    @Path("large")
    public RestResponse<Payload> large() {
        return RestResponse.ResponseBuilder.ok(p.large()).header(Serial.HEADER, Serial.next()).build();
    }
}
