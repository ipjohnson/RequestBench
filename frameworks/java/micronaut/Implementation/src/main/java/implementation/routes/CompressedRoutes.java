package implementation.routes;

import implementation.Payload;
import implementation.Payloads;
import implementation.Serial;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;

/**
 * compressed: these routes answer like any other. The Netty server's compression, which
 * application.properties sets to gzip's fastest level for the whole server, gzips the answer when
 * the request asks for it.
 */
@Controller
public class CompressedRoutes {

    private final Payloads p;

    CompressedRoutes(Payloads p) {
        this.p = p;
    }

    @Get("/compressed/small")
    public HttpResponse<Payload> small() {
        return Serial.ok(p.small());
    }

    @Get("/compressed/large")
    public HttpResponse<Payload> large() {
        return Serial.ok(p.large());
    }
}
