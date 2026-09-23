package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Set;

import io.vertx.core.json.JsonObject;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

/** errors: every refusal is Vert.x's own. */
class ErrorsTests extends VertxApp {

    // rb:test errors.unmatched
    @Test
    @Tag("errors.unmatched")
    void aPathNoRouteMatchesIsTheRoutersOwn404Page() throws Exception {
        HttpResponse<byte[]> response = get("/errors/unmatched");

        assertEquals(404, response.statusCode());
        assertEquals("text/html; charset=utf-8", Answer.header(response, "content-type"));
        assertEquals("<html><body><h1>Resource not found</h1></body></html>", Answer.text(response));
    }

    // rb:test errors.not_found
    @Test
    @Tag("errors.not_found")
    void anIdWithNoRowIsTheHandlers404WithNoBody() throws Exception {
        HttpResponse<byte[]> response = get("/items/999999");

        assertEquals(404, response.statusCode());
        assertEquals(0, response.body().length);
    }

    // rb:test errors.wrong_method
    @Test
    @Tag("errors.wrong_method")
    void aMethodThePathHasNoRouteForIs405() throws Exception {
        HttpResponse<byte[]> response = send("POST", "/items/17", "application/json", new byte[0]);

        assertEquals(405, response.statusCode());
        assertEquals(Set.of("GET", "HEAD", "PUT", "PATCH", "DELETE"), Set.of(Answer.header(response, "allow").split(",")));
    }

    // rb:test errors.malformed
    @Test
    @Tag("errors.malformed")
    void aBodyThatIsNotJsonIsTheValidationHandlersParsingError() throws Exception {
        byte[] body = "{\"customerId\": 1, \"lines\": [".getBytes(StandardCharsets.UTF_8);

        HttpResponse<byte[]> response = send("POST", "/body/validate/small", "application/json", body);

        assertEquals(400, response.statusCode());
        assertEquals("application/json", Answer.header(response, "content-type"));
        JsonObject refused = Answer.json(response);
        assertEquals("BodyProcessorException", refused.getString("type"));
        assertEquals("PARSING_ERROR", refused.getString("errorType"));
    }
}
