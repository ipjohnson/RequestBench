package implementation.routes;

import implementation.Payload;
import implementation.Payloads;
import implementation.Serial;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;

/**
 * cors: Micronaut's CorsFilter, with the policy application.properties names. It answers a preflight
 * before any route runs, so the absence of x-rb-serial on a preflight shows the feature answered
 * alone. It adds Vary: Origin to every answer it decorates.
 */
@Controller
public class CorsRoutes {

    private final Payloads p;

    CorsRoutes(Payloads p) {
        this.p = p;
    }

    @Get("/cors/small")
    public HttpResponse<Payload> small() {
        return Serial.ok(p.small());
    }
}
