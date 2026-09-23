package implementation.routes;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.Arrays;

import implementation.Item;
import implementation.Payloads;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import io.micronaut.json.JsonMapper;
import org.reactivestreams.Publisher;
import reactor.core.publisher.Flux;

/**
 * stream: items.medium's rows written one per line. The handler returns a Publisher, and Micronaut
 * writes each element it emits as a chunk of the body, so the length is never known and the answer
 * goes out chunked.
 */
@Controller
public class StreamRoutes {

    private static final String NDJSON = "application/x-ndjson";

    private final Payloads p;

    private final JsonMapper json;

    StreamRoutes(Payloads p, JsonMapper json) {
        this.p = p;
        this.json = json;
    }

    @Get(value = "/stream/items", produces = NDJSON)
    public Publisher<byte[]> items() {
        return Flux.fromIterable(p.medium().items()).map(this::line);
    }

    /** The row as JSON, and a newline. */
    private byte[] line(Item row) {
        try {
            byte[] written = json.writeValueAsBytes(row);
            byte[] line = Arrays.copyOf(written, written.length + 1);
            line[written.length] = '\n';
            return line;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
