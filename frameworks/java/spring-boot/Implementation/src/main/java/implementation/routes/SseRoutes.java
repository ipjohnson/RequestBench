package implementation.routes;

import java.io.IOException;

import implementation.Item;
import implementation.Payloads;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * sse: items.medium's rows as server-sent events, through Spring MVC's SseEmitter, which writes
 * each row with the JSON message converter as the data of one event.
 */
@RestController
public class SseRoutes {

    private final Payloads p;

    SseRoutes(Payloads p) {
        this.p = p;
    }

    @GetMapping("/sse/medium")
    public SseEmitter medium() throws IOException {
        SseEmitter events = new SseEmitter();
        for (Item row : p.medium().items()) {
            events.send(SseEmitter.event().data(row));
        }
        events.complete();
        return events;
    }
}
