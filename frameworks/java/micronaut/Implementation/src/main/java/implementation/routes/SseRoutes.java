package implementation.routes;

import implementation.Item;
import implementation.Payloads;
import io.micronaut.http.MediaType;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import io.micronaut.http.sse.Event;
import org.reactivestreams.Publisher;
import reactor.core.publisher.Flux;

/**
 * sse: items.medium's rows as server-sent events. The handler returns a Publisher of Event, and
 * Micronaut writes each one's data as JSON, as one event.
 */
@Controller
public class SseRoutes {

    private final Payloads p;

    SseRoutes(Payloads p) {
        this.p = p;
    }

    @Get(value = "/sse/medium", produces = MediaType.TEXT_EVENT_STREAM)
    public Publisher<Event<Item>> medium() {
        return Flux.fromIterable(p.medium().items()).map(Event::of);
    }
}
