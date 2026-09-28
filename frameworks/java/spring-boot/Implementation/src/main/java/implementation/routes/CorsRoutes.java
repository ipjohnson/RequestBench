package implementation.routes;

import implementation.Payload;
import implementation.Payloads;
import implementation.Serial;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

/**
 * cors: Spring MVC's CORS support, from @CrossOrigin on the handler and nowhere else. It answers a
 * preflight before the handler runs, so the absence of x-rb-serial on a preflight shows the feature
 * answered alone. It adds Vary: Origin to every answer the handler's route gives.
 */
@RestController
public class CorsRoutes {

    private final Payloads p;

    CorsRoutes(Payloads p) {
        this.p = p;
    }

    @GetMapping("/cors/small")
    // rb:wiring cors.*
    @CrossOrigin(origins = "https://shop.example.com", methods = RequestMethod.GET, allowedHeaders = "x-rb-tenant", maxAge = 600)
    // rb:end
    public Payload small(HttpServletResponse response) {
        Serial.write(response);
        return p.small();
    }
}
