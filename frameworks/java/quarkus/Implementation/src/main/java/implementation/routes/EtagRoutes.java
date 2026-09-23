package implementation.routes;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import implementation.Payload;
import implementation.Payloads;
import implementation.Serial;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.core.EntityTag;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Request;
import jakarta.ws.rs.core.Response;

/**
 * etag: Jakarta REST's conditional requests. Request.evaluatePreconditions compares the entity tag
 * with If-None-Match and builds the 304. Neither Jakarta REST nor Quarkus computes a tag for an
 * answer, so the handler serialises the payload itself and hashes the bytes. The body is built and
 * hashed before anything is compared, so a 304 saves the write and nothing else.
 */
@Path("/etag")
public class EtagRoutes {

    private final Payloads p;

    private final ObjectMapper json;

    EtagRoutes(Payloads p, ObjectMapper json) {
        this.p = p;
        this.json = json;
    }

    // rb:handler etag.small
    @GET
    @Path("small")
    public Response small(Request request) throws JsonProcessingException, NoSuchAlgorithmException {
        return tagged(request, p.small());
    }

    // rb:handler etag.large,etag.match_large,etag.stale_large
    @GET
    @Path("large")
    public Response large(Request request) throws JsonProcessingException, NoSuchAlgorithmException {
        return tagged(request, p.large());
    }

    // rb:wiring etag.*
    /** The payload as the bytes that go out, tagged with their SHA-1, or a 304 when If-None-Match names the tag. */
    private Response tagged(Request request, Payload payload) throws JsonProcessingException, NoSuchAlgorithmException {
        byte[] body = json.writeValueAsBytes(payload);
        EntityTag tag = new EntityTag(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-1").digest(body)));
        Response.ResponseBuilder notModified = request.evaluatePreconditions(tag);
        Response.ResponseBuilder answer = notModified != null ? notModified : Response.ok(body, MediaType.APPLICATION_JSON_TYPE).tag(tag);
        return answer.header(Serial.HEADER, Serial.next()).build();
    }
}
