package implementation.routes;

import implementation.Echoed;
import implementation.Payload;
import implementation.Payloads;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import org.jboss.resteasy.reactive.RestPath;

/**
 * parameters: router captures, each bound by a @RestPath parameter named after it, as the integer
 * its type says. Jakarta REST prefers the template with more literal characters, so the static
 * route wins over a capture.
 */
@Path("/parameters")
public class ParametersRoutes {

    public record One(int one) {}

    public record Two(int one, int two) {}

    private final Payloads p;

    ParametersRoutes(Payloads p) {
        this.p = p;
    }

    // rb:handler parameters.static
    @GET
    @Path("static/segment/literal")
    public Payload literal() {
        return p.small();
    }

    // rb:handler parameters.one
    @GET
    @Path("{one}/segment/literal")
    public Echoed<One> one(@RestPath int one) {
        return Echoed.of(p.small(), new One(one));
    }

    // rb:handler parameters.two
    @GET
    @Path("{one}/with-second/{two}")
    public Echoed<Two> two(@RestPath int one, @RestPath int two) {
        return Echoed.of(p.small(), new Two(one, two));
    }
}
