package implementation.routes;

import io.micronaut.http.MediaType;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;

/** baseline: the dispatch floor, with nothing serialised. */
@Controller
public class BaselineRoutes {

    @Get(value = "/plaintext", produces = MediaType.TEXT_PLAIN)
    public String plaintext() {
        return "Hello, World!";
    }
}
