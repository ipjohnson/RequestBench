package implementation.routes;

import implementation.Payload;
import implementation.Payloads;
import implementation.Serial;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * compressed: these routes answer like any other. Tomcat's compression, which
 * application.properties turns on for the whole connector, gzips the answer when the request asks
 * for it.
 */
@RestController
public class CompressedRoutes {

    private final Payloads p;

    CompressedRoutes(Payloads p) {
        this.p = p;
    }

    @GetMapping("/compressed/small")
    public Payload small(HttpServletResponse response) {
        Serial.write(response);
        return p.small();
    }

    @GetMapping("/compressed/large")
    public Payload large(HttpServletResponse response) {
        Serial.write(response);
        return p.large();
    }
}
