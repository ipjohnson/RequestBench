package implementation.routes;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

/** baseline: the dispatch floor, with nothing serialised. */
@Path("/plaintext")
public class BaselineRoutes {

    // rb:handler baseline.plaintext
    @GET
    @Produces(MediaType.TEXT_PLAIN)
    public String plaintext() {
        return "Hello, World!";
    }
}
