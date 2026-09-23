package implementation.routes;

import implementation.Payload;
import implementation.Payloads;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;

/**
 * json: a payload the framework already holds, serialised at three sizes by the Jackson writer
 * Quarkus REST writes a returned object with.
 */
@Path("/json")
public class JsonRoutes {

    private final Payloads p;

    JsonRoutes(Payloads p) {
        this.p = p;
    }

    // rb:handler json.small
    @GET
    @Path("small")
    public Payload small() {
        return p.small();
    }

    // rb:handler json.medium
    @GET
    @Path("medium")
    public Payload medium() {
        return p.medium();
    }

    // rb:handler json.large
    @GET
    @Path("large")
    public Payload large() {
        return p.large();
    }
}
