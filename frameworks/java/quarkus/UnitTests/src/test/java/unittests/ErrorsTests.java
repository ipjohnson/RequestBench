package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static unittests.Http.get;
import static unittests.Http.send;

import java.nio.charset.StandardCharsets;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.response.Response;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

/** errors: every refusal is Quarkus's own. None but the router's 404 carries a body. */
@QuarkusTest
class ErrorsTests {

    // rb:test errors.unmatched
    @Test
    @Tag("errors.unmatched")
    void aPathNoRouteMatchesIsVertxs404Page() {
        Response response = get("/errors/unmatched");

        assertEquals(404, response.statusCode());
        assertEquals("text/html; charset=utf-8", response.contentType());
    }

    // rb:test errors.not_found
    @Test
    @Tag("errors.not_found")
    void anIdWithNoRowIsTheHandlers404() {
        empty(404, get("/items/999999"));
    }

    // rb:test errors.wrong_method
    @Test
    @Tag("errors.wrong_method")
    void aMethodThePathHasNoResourceMethodForIs405() {
        empty(405, send("POST", "/items/17", "application/json", new byte[0]));
    }

    // rb:test errors.malformed
    @Test
    @Tag("errors.malformed")
    void aBodyThatIsNotJsonIsA400() {
        byte[] body = "{\"customerId\": 1, \"lines\": [".getBytes(StandardCharsets.UTF_8);

        assertEquals(400, send("POST", "/body/validate/small", "application/json", body).statusCode());
    }

    private static void empty(int status, Response response) {
        assertEquals(status, response.statusCode());
        assertEquals(0, response.asByteArray().length);
    }
}
