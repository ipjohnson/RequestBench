package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

/** errors: every refusal is Helidon's own, written as text/plain by its default error handling. */
class ErrorsTests extends HelidonApp {

    // rb:test errors.unmatched
    @Test
    @Tag("errors.unmatched")
    void aPathNoRouteMatchesIsTheRouters404() throws Exception {
        refused(404, "Endpoint not found", get("/errors/unmatched"));
    }

    // rb:test errors.not_found
    @Test
    @Tag("errors.not_found")
    void anIdWithNoRowIsTheHandlersNotFoundException() throws Exception {
        refused(404, "No item has id 999999", get("/items/999999"));
    }

    // rb:test errors.wrong_method
    @Test
    @Tag("errors.wrong_method")
    void aMethodThePathHasNoRouteForIsTheSame404() throws Exception {
        refused(404, "Endpoint not found", send("POST", "/items/17", "application/json", new byte[0]));
    }

    // rb:test errors.malformed
    @Test
    @Tag("errors.malformed")
    void aBodyThatIsNotJsonIsHelidonJsonBindings400AndTheConnectionCloses() throws Exception {
        byte[] body = "{\"customerId\": 1, \"lines\": [".getBytes(StandardCharsets.UTF_8);

        HttpResponse<byte[]> response = send("POST", "/body/validate/small", "application/json", body);

        refused(400, "Failed to deserialize JSON request entity", response);
    }

    private static void refused(int status, String text, HttpResponse<byte[]> response) {
        assertEquals(status, response.statusCode());
        assertEquals("text/plain", Answer.header(response, "content-type"));
        assertEquals(text, Answer.text(response));
    }
}
