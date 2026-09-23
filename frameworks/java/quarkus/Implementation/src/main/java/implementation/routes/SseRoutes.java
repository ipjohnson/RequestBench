package implementation.routes;

import implementation.Item;
import implementation.Payloads;
import io.smallrye.mutiny.Multi;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import org.jboss.resteasy.reactive.RestStreamElementType;

/**
 * sse: items.medium's rows as server-sent events. Quarkus REST sends each item of the Multi as the
 * data of one event, serialised as the element type says, for a method that produces
 * text/event-stream.
 */
@Path("/sse")
public class SseRoutes {

    private final Payloads p;

    SseRoutes(Payloads p) {
        this.p = p;
    }

    // rb:handler sse.medium
    @GET
    @Path("medium")
    @Produces(MediaType.SERVER_SENT_EVENTS)
    @RestStreamElementType(MediaType.APPLICATION_JSON)
    public Multi<Item> medium() {
        return Multi.createFrom().iterable(p.medium().items());
    }
}
