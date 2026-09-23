package implementation.routes;

import implementation.Echoed;
import implementation.Payload;
import implementation.Payloads;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import org.jboss.resteasy.reactive.RestHeader;

/**
 * headers: /headers reads no header, and /headers/bind binds three by declaring them on the
 * handler, the account as an integer.
 */
@Path("/headers")
public class HeadersRoutes {

    public record Bound(String tenant, String requestId, int account) {}

    private final Payloads p;

    HeadersRoutes(Payloads p) {
        this.p = p;
    }

    // rb:handler headers.few,headers.many
    @GET
    public Payload headers() {
        return p.small();
    }

    // rb:handler headers.bind_few,headers.bind_many
    @GET
    @Path("bind")
    public Echoed<Bound> bind(@RestHeader("x-rb-tenant") String tenant,
                              @RestHeader("x-rb-request-id") String requestId,
                              @RestHeader("x-rb-account") int account) {
        return Echoed.of(p.small(), new Bound(tenant, requestId, account));
    }
}
