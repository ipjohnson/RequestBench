package implementation.routes;

import implementation.Echoed;
import implementation.Payload;
import implementation.Payloads;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * parameters: router captures, each bound by naming a handler parameter after it, as the integer
 * its type says. The literal segment of the static route wins over a capture.
 */
@RestController
public class ParametersRoutes {

    public record One(int one) {}

    public record Two(int one, int two) {}

    private final Payloads p;

    ParametersRoutes(Payloads p) {
        this.p = p;
    }

    @GetMapping("/parameters/static/segment/literal")
    public Payload literal() {
        return p.small();
    }

    @GetMapping("/parameters/{one}/segment/literal")
    public Echoed<One> one(@PathVariable int one) {
        return Echoed.of(p.small(), new One(one));
    }

    @GetMapping("/parameters/{one}/with-second/{two}")
    public Echoed<Two> two(@PathVariable int one, @PathVariable int two) {
        return Echoed.of(p.small(), new Two(one, two));
    }
}
