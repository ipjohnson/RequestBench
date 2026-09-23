package implementation.routes;

import implementation.Echoed;
import implementation.Payload;
import implementation.Payloads;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import io.micronaut.http.annotation.Header;
import io.micronaut.serde.annotation.Serdeable;

/**
 * headers: /headers reads no header, and /headers/bind binds three by declaring them on the
 * handler, the account as an integer.
 */
@Controller
public class HeadersRoutes {

    @Serdeable
    public record Bound(String tenant, String requestId, int account) {}

    private final Payloads p;

    HeadersRoutes(Payloads p) {
        this.p = p;
    }

    @Get("/headers")
    public Payload headers() {
        return p.small();
    }

    @Get("/headers/bind")
    public Echoed<Bound> bind(@Header("x-rb-tenant") String tenant,
                              @Header("x-rb-request-id") String requestId,
                              @Header("x-rb-account") int account) {
        return Echoed.of(p.small(), new Bound(tenant, requestId, account));
    }
}
