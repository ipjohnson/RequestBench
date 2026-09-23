package implementation.routes;

import implementation.Payload;
import implementation.Payloads;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;

/**
 * json: a payload the framework already holds, serialised at three sizes by Micronaut
 * Serialization, which writes a returned object as JSON.
 */
@Controller
public class JsonRoutes {

    private final Payloads p;

    JsonRoutes(Payloads p) {
        this.p = p;
    }

    @Get("/json/small")
    public Payload small() {
        return p.small();
    }

    @Get("/json/medium")
    public Payload medium() {
        return p.medium();
    }

    @Get("/json/large")
    public Payload large() {
        return p.large();
    }
}
