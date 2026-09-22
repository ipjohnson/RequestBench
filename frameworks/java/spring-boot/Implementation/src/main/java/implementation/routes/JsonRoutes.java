package implementation.routes;

import implementation.Payload;
import implementation.Payloads;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * json: a payload the framework already holds, serialised at three sizes by the Jackson message
 * converter Spring MVC writes a returned object with.
 */
@RestController
public class JsonRoutes {

    private final Payloads p;

    JsonRoutes(Payloads p) {
        this.p = p;
    }

    @GetMapping("/json/small")
    public Payload small() {
        return p.small();
    }

    @GetMapping("/json/medium")
    public Payload medium() {
        return p.medium();
    }

    @GetMapping("/json/large")
    public Payload large() {
        return p.large();
    }
}
