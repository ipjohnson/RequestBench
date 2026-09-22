package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Set;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

/** errors: every refusal is Spring's own, and Boot's error page writes each body. */
class ErrorsTests extends SpringApp {

    // rb:test errors.unmatched
    @Test
    @Tag("errors.unmatched")
    void aPathNoHandlerMatchesIsBootsErrorPage404() throws Exception {
        errorPage(404, get("/errors/unmatched"));
    }

    // rb:test errors.not_found
    @Test
    @Tag("errors.not_found")
    void anIdWithNoRowIsTheHandlers404() throws Exception {
        errorPage(404, get("/items/999999"));
    }

    // rb:test errors.wrong_method
    @Test
    @Tag("errors.wrong_method")
    void aMethodThePathHasNoHandlerForIs405() throws Exception {
        HttpResponse<byte[]> response = send("POST", "/items/17", "application/json", new byte[0]);

        errorPage(405, response);
        assertEquals(Set.of("GET", "PUT", "PATCH", "DELETE"), Set.of(Answer.header(response, "allow").split(",\\s*")));
    }

    // rb:test errors.malformed
    @Test
    @Tag("errors.malformed")
    void aBodyThatIsNotJsonIsJacksons400() throws Exception {
        byte[] body = "{\"customerId\": 1, \"lines\": [".getBytes(StandardCharsets.UTF_8);

        errorPage(400, send("POST", "/body/validate/small", "application/json", body));
    }

    private static void errorPage(int status, HttpResponse<byte[]> response) {
        assertEquals(status, response.statusCode());
        assertEquals("application/json", Answer.header(response, "content-type"));
        assertEquals(status, Answer.json(response).get("status").asInt());
    }
}
