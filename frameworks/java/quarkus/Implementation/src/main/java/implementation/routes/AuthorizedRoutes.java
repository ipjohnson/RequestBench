package implementation.routes;

import implementation.Payload;
import implementation.Payloads;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;

/**
 * authorized: the route Quarkus's HTTP security guards before routing, with the permission in
 * application.properties and the policy in BearerTokenPolicy.
 */
@Path("/authorized")
public class AuthorizedRoutes {

    private final Payloads p;

    AuthorizedRoutes(Payloads p) {
        this.p = p;
    }

    // BearerTokenPolicy refuses a denied request before it is routed, so this method answers only the
    // allowed one. It is marked for both rows, which share the route.
    // rb:handler authorized.allowed,authorized.denied
    @GET
    @Path("small")
    public Payload small() {
        return p.small();
    }
}
