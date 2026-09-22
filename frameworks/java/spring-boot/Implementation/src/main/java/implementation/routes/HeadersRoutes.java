package implementation.routes;

import implementation.Echoed;
import implementation.Payload;
import implementation.Payloads;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/**
 * headers: /headers reads no header, and /headers/bind binds three by declaring them on the
 * handler, the account as an integer.
 */
@RestController
public class HeadersRoutes {

    public record Bound(String tenant, String requestId, int account) {}

    private final Payloads p;

    HeadersRoutes(Payloads p) {
        this.p = p;
    }

    @GetMapping("/headers")
    public Payload headers() {
        return p.small();
    }

    @GetMapping("/headers/bind")
    public Echoed<Bound> bind(@RequestHeader("x-rb-tenant") String tenant,
                              @RequestHeader("x-rb-request-id") String requestId,
                              @RequestHeader("x-rb-account") int account) {
        return Echoed.of(p.small(), new Bound(tenant, requestId, account));
    }
}
