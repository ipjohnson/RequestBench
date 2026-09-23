package implementation.routes;

import implementation.Item;
import implementation.Payloads;
import io.helidon.common.media.type.MediaTypes;
import io.helidon.http.sse.SseEvent;
import io.helidon.webserver.http.HttpFeature;
import io.helidon.webserver.http.HttpRouting;
import io.helidon.webserver.sse.SseSink;

/**
 * sse: items.medium's rows as server-sent events, through Helidon's SseSink, which writes each row
 * as the data of one event, serialised by the JSON media support the event names, and flushes it.
 */
public final class SseRoutes implements HttpFeature {

    private final Payloads p;

    public SseRoutes(Payloads p) {
        this.p = p;
    }

    @Override
    public void setup(HttpRouting.Builder routing) {
        routing.get("/sse/medium", (req, res) -> {
            try (SseSink events = res.sink(SseSink.TYPE)) {
                for (Item row : p.medium().items()) {
                    events.emit(SseEvent.create(row, MediaTypes.APPLICATION_JSON));
                }
            }
        });
    }
}
