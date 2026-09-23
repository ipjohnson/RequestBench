package implementation.routes;

import java.io.OutputStream;

import implementation.Item;
import implementation.Payloads;
import io.helidon.common.media.type.MediaTypes;
import io.helidon.json.binding.JsonBinding;
import io.helidon.webserver.http.HttpFeature;
import io.helidon.webserver.http.HttpRouting;

/**
 * stream: items.medium's rows written to the response's output stream one per line, each flushed
 * as it is written. The length is never known, so the answer goes out chunked.
 */
public final class StreamRoutes implements HttpFeature {

    private final Payloads p;

    private final JsonBinding json = JsonBinding.create();

    public StreamRoutes(Payloads p) {
        this.p = p;
    }

    @Override
    public void setup(HttpRouting.Builder routing) {
        routing.get("/stream/items", (req, res) -> {
            res.headers().contentType(MediaTypes.APPLICATION_X_NDJSON);
            try (OutputStream out = res.outputStream()) {
                for (Item row : p.medium().items()) {
                    out.write(json.serializeToBytes(row, Item.class));
                    out.write('\n');
                    out.flush();
                }
            }
        });
    }
}
