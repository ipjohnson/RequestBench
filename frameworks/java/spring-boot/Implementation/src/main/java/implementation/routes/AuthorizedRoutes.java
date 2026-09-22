package implementation.routes;

import implementation.Payload;
import implementation.Payloads;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** authorized: the route Spring Security guards, configured in AuthorizedSecurity. */
@RestController
public class AuthorizedRoutes {

    private final Payloads p;

    AuthorizedRoutes(Payloads p) {
        this.p = p;
    }

    @GetMapping("/authorized/small")
    public Payload small() {
        return p.small();
    }
}
