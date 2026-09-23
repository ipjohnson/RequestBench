package implementation.routes;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

import implementation.Payload;
import implementation.Payloads;
import implementation.Serial;
import io.micronaut.http.HttpHeaders;
import io.micronaut.http.HttpRequest;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.HttpStatus;
import io.micronaut.http.MediaType;
import io.micronaut.http.MutableHttpResponse;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import io.micronaut.http.annotation.ResponseFilter;
import io.micronaut.http.annotation.ServerFilter;
import io.micronaut.json.JsonMapper;

/**
 * etag: Micronaut computes no ETag for an answer a handler returns, so a response filter on these
 * two routes does. It serialises the body the handler returned, hashes it with SHA-1 into the
 * ETag, and answers a matching If-None-Match with 304 in place of the body. The handler runs and
 * the body is built before anything is compared, so a 304 saves the write and nothing else.
 */
@Controller
public class EtagRoutes {

    private final Payloads p;

    EtagRoutes(Payloads p) {
        this.p = p;
    }

    @Get("/etag/small")
    public HttpResponse<Payload> small() {
        return Serial.ok(p.small());
    }

    @Get("/etag/large")
    public HttpResponse<Payload> large() {
        return Serial.ok(p.large());
    }

    // rb:wiring etag.*
    /** Scoped to /etag/** by its pattern, so no other route runs it. */
    @ServerFilter("/etag/**")
    static final class Validators {

        private final JsonMapper json;

        Validators(JsonMapper json) {
            this.json = json;
        }

        /** The serialised bytes go out as the body, so the payload is serialised once. */
        @ResponseFilter
        @SuppressWarnings("unchecked")
        public void validate(HttpRequest<?> request, MutableHttpResponse<?> response) throws IOException, NoSuchAlgorithmException {
            Object body = response.body();
            if (body == null) {
                return;
            }
            byte[] bytes = json.writeValueAsBytes(body);
            String etag = '"' + HexFormat.of().formatHex(MessageDigest.getInstance("SHA-1").digest(bytes)) + '"';
            response.header(HttpHeaders.ETAG, etag);
            if (etag.equals(request.getHeaders().get(HttpHeaders.IF_NONE_MATCH))) {
                ((MutableHttpResponse<Object>) response).status(HttpStatus.NOT_MODIFIED).body(null);
                return;
            }
            ((MutableHttpResponse<Object>) response).body(bytes).contentType(MediaType.APPLICATION_JSON_TYPE);
        }
    }
}
