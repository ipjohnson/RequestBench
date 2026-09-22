package implementation.routes;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** baseline: the dispatch floor, with nothing serialised. */
@RestController
public class BaselineRoutes {

    @GetMapping(value = "/plaintext", produces = MediaType.TEXT_PLAIN_VALUE)
    public String plaintext() {
        return "Hello, World!";
    }
}
