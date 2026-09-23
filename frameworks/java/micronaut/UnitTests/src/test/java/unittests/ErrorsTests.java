package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Set;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

/** errors: every refusal is Micronaut's own, and its default error processor writes each body. */
class ErrorsTests extends MicronautApp {

    // rb:test errors.unmatched
    @Test
    @Tag("errors.unmatched")
    void aPathNoRouteMatchesIsTheRouters404() throws Exception {
        errorBody(404, "Not Found", get("/errors/unmatched"));
    }

    // rb:test errors.not_found
    @Test
    @Tag("errors.not_found")
    void anIdWithNoRowIsTheHandlers404() throws Exception {
        errorBody(404, "Not Found", get("/items/999999"));
    }

    // rb:test errors.wrong_method
    @Test
    @Tag("errors.wrong_method")
    void aMethodThePathHasNoRouteForIs405() throws Exception {
        HttpResponse<byte[]> response = send("POST", "/items/17", "application/json", new byte[0]);

        errorBody(405, "Method Not Allowed", response);
        assertEquals(Set.of("GET", "HEAD", "PUT", "PATCH", "DELETE"), Set.of(Answer.header(response, "allow").split(",\\s*")));
    }

    // rb:test errors.malformed
    @Test
    @Tag("errors.malformed")
    void aBodyThatIsNotJsonIsRefusedWith400() throws Exception {
        byte[] body = "{\"customerId\": 1, \"lines\": [".getBytes(StandardCharsets.UTF_8);

        errorBody(400, "Bad Request", send("POST", "/body/validate/small", "application/json", body));
    }

    private static void errorBody(int status, String message, HttpResponse<byte[]> response) {
        assertEquals(status, response.statusCode());
        assertEquals("application/json", Answer.header(response, "content-type"));
        assertEquals(message, Answer.json(response).get("message").getStringValue());
    }
}
