package implementation.routes;

import implementation.Echoed;
import implementation.Payload;
import implementation.Payloads;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import io.micronaut.http.annotation.PathVariable;
import io.micronaut.serde.annotation.Serdeable;

/**
 * parameters: router captures, each bound to the handler parameter it names, as the integer its
 * type says. The router prefers the route with fewer variables, so the static route wins over a
 * capture.
 */
@Controller
public class ParametersRoutes {

    @Serdeable
    public record One(int one) {}

    @Serdeable
    public record Two(int one, int two) {}

    private final Payloads p;

    ParametersRoutes(Payloads p) {
        this.p = p;
    }

    @Get("/parameters/static/segment/literal")
    public Payload literal() {
        return p.small();
    }

    @Get("/parameters/{one}/segment/literal")
    public Echoed<One> one(@PathVariable int one) {
        return Echoed.of(p.small(), new One(one));
    }

    @Get("/parameters/{one}/with-second/{two}")
    public Echoed<Two> two(@PathVariable int one, @PathVariable int two) {
        return Echoed.of(p.small(), new Two(one, two));
    }
}
