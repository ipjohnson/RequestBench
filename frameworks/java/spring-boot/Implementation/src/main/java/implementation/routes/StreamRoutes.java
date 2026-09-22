package implementation.routes;

import implementation.Item;
import implementation.Payloads;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import tools.jackson.databind.json.JsonMapper;

/**
 * stream: items.medium's rows written one per line and flushed as each is written, through Spring
 * MVC's StreamingResponseBody, which runs on the MVC task executor once the handler returns. The
 * length is never known, so the answer goes out chunked.
 */
@RestController
public class StreamRoutes {

    private static final MediaType NDJSON = MediaType.parseMediaType("application/x-ndjson");

    private final Payloads p;

    private final JsonMapper json;

    StreamRoutes(Payloads p, JsonMapper json) {
        this.p = p;
        this.json = json;
    }

    @GetMapping("/stream/items")
    public ResponseEntity<StreamingResponseBody> items() {
        StreamingResponseBody rows = out -> {
            for (Item row : p.medium().items()) {
                out.write(json.writeValueAsBytes(row));
                out.write('\n');
                out.flush();
            }
        };
        return ResponseEntity.ok().contentType(NDJSON).body(rows);
    }
}
