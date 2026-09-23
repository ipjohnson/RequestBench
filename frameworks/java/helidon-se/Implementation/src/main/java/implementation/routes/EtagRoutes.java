package implementation.routes;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

import implementation.Payload;
import implementation.Payloads;
import implementation.Serial;
import io.helidon.common.media.type.MediaTypes;
import io.helidon.http.HeaderNames;
import io.helidon.http.Status;
import io.helidon.json.binding.JsonBinding;
import io.helidon.webserver.http.HttpFeature;
import io.helidon.webserver.http.HttpRouting;
import io.helidon.webserver.http.ServerRequest;
import io.helidon.webserver.http.ServerResponse;

/**
 * etag: Helidon SE computes a validator for a static file and for nothing a handler writes, so the
 * revalidation is written for this family. The body is built and hashed before anything is
 * compared, so a 304 saves the write and nothing else.
 */
public final class EtagRoutes implements HttpFeature {

    private final Payloads p;

    private final JsonBinding json = JsonBinding.create();

    public EtagRoutes(Payloads p) {
        this.p = p;
    }

    @Override
    public void setup(HttpRouting.Builder routing) {
        routing.get("/etag/small", (req, res) -> revalidate(req, res, p.small()));

        routing.get("/etag/large", (req, res) -> revalidate(req, res, p.large()));
    }

    // rb:wiring etag.*
    /**
     * Serialises the payload, hashes the bytes with SHA-1 into the ETag, and answers 304 with no
     * body when If-None-Match already names it.
     */
    private void revalidate(ServerRequest req, ServerResponse res, Payload payload) {
        Serial.write(res);
        byte[] body = json.serializeToBytes(payload, Payload.class);
        String tag = '"' + HexFormat.of().formatHex(sha1(body)) + '"';
        res.header(HeaderNames.ETAG, tag);
        if (req.headers().value(HeaderNames.IF_NONE_MATCH).map(it -> names(it, tag)).orElse(false)) {
            res.status(Status.NOT_MODIFIED_304).send();
            return;
        }
        res.headers().contentType(MediaTypes.APPLICATION_JSON);
        res.send(body);
    }

    /** Whether an If-None-Match list names the tag, each entry compared weakly as RFC 9110 has a GET compared. */
    private static boolean names(String ifNoneMatch, String tag) {
        for (String candidate : ifNoneMatch.split(",")) {
            String trimmed = candidate.strip();
            if (trimmed.equals("*") || trimmed.equals(tag) || trimmed.equals("W/" + tag)) {
                return true;
            }
        }
        return false;
    }

    private static byte[] sha1(byte[] body) {
        try {
            return MessageDigest.getInstance("SHA-1").digest(body);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
    // rb:end
}
