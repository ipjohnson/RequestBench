package implementation.routes;

import java.io.OutputStream;

import implementation.Echoed;
import implementation.Payloads;
import implementation.Search;
import io.helidon.common.parameters.Parameters;
import io.helidon.http.media.multipart.MultiPart;
import io.helidon.http.media.multipart.ReadablePart;
import io.helidon.json.binding.Json;
import io.helidon.webserver.http.HttpFeature;
import io.helidon.webserver.http.HttpRouting;

/**
 * forms: bodies read through Helidon's media support. The urlencoded form is read into
 * Parameters, the type the query string is parsed into, and binds query.many's record the same
 * way. The multipart upload is read part by part in the order it arrives, and the file part is read
 * through to its end and counted.
 */
public final class FormsRoutes implements HttpFeature {

    @Json.Entity
    public record UploadedFile(String name, long bytes) {}

    @Json.Entity
    public record UploadEcho(String tenant, String requestId) {}

    @Json.Entity
    public record Uploaded(UploadedFile file, UploadEcho echo) {}

    private final Payloads p;

    public FormsRoutes(Payloads p) {
        this.p = p;
    }

    @Override
    public void setup(HttpRouting.Builder routing) {
        routing.post("/forms/urlencoded", (req, res) -> res.send(Echoed.of(p.small(), Search.of(req.content().as(Parameters.class)))));

        routing.post("/forms/multipart", (req, res) -> {
            MultiPart parts = req.content().as(MultiPart.class);
            String tenant = null;
            String requestId = null;
            UploadedFile file = null;
            while (parts.hasNext()) {
                ReadablePart part = parts.next();
                switch (part.name()) {
                    case "tenant" -> tenant = part.as(String.class);
                    case "requestId" -> requestId = part.as(String.class);
                    case "file" -> file = new UploadedFile(part.fileName().orElseThrow(), part.inputStream().transferTo(OutputStream.nullOutputStream()));
                    default -> part.consume();
                }
            }
            res.send(new Uploaded(file, new UploadEcho(tenant, requestId)));
        });
    }
}
