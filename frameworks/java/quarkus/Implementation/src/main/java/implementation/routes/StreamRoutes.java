package implementation.routes;

import implementation.Item;
import implementation.Payloads;
import io.smallrye.mutiny.Multi;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import org.jboss.resteasy.reactive.RestStreamElementType;
import org.jboss.resteasy.reactive.common.util.RestMediaType;

/**
 * stream: items.medium's rows as a Multi, which Quarkus REST writes one per line for a method that
 * produces application/x-ndjson, each row serialised as the element type says and sent as it
 * comes. The length is never known, so the answer goes out chunked.
 */
@Path("/stream")
public class StreamRoutes {

    private final Payloads p;

    StreamRoutes(Payloads p) {
        this.p = p;
    }

    // rb:handler stream.ndjson
    @GET
    @Path("items")
    @Produces(RestMediaType.APPLICATION_NDJSON)
    @RestStreamElementType(MediaType.APPLICATION_JSON)
    public Multi<Item> items() {
        return Multi.createFrom().iterable(p.medium().items());
    }
}
