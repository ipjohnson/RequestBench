package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import io.javalin.testtools.JavalinTest;
import io.javalin.testtools.Response;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

/** errors: every refusal is Javalin's own. */
class ErrorsTests extends JavalinApp {

    // rb:test errors.unmatched
    @Test
    @Tag("errors.unmatched")
    void aPathNoRouteMatchesIsTheRoutersTextual404() {
        JavalinTest.test(app(), (server, client) -> {
            Response response = client.get("/errors/unmatched");

            assertEquals(404, response.code());
            assertTrue(Answer.header(response, "content-type").startsWith("text/plain"));
            assertEquals("Endpoint GET /errors/unmatched not found", response.body().string());
        });
    }

    // rb:test errors.not_found
    @Test
    @Tag("errors.not_found")
    void anIdWithNoRowIsTheHandlersNotFoundResponse() {
        JavalinTest.test(app(), (server, client) -> {
            Response response = client.get("/items/999999");

            assertEquals(404, response.code());
            assertEquals("Not Found", response.body().string());
        });
    }

    // rb:test errors.wrong_method
    @Test
    @Tag("errors.wrong_method")
    void aMethodThePathHasNoRouteForIsThe404OfAnUnknownPath() {
        JavalinTest.test(app(), (server, client) -> {
            Response response = client.post("/items/17", "{}");

            assertEquals(404, response.code());
            assertEquals("Endpoint POST /items/17 not found", response.body().string());
        });
    }

    // rb:test errors.malformed
    @Test
    @Tag("errors.malformed")
    void aBodyThatIsNotJsonFailsTheValidatorUnderRequestBody() {
        JavalinTest.test(app(), (server, client) -> {
            Response response = client.post("/body/validate/small", "{\"customerId\": 1, \"lines\": [");

            assertEquals(400, response.code());
            JsonNode failure = Answer.json(response).get("REQUEST_BODY").get(0);
            assertEquals("DESERIALIZATION_FAILED", failure.get("message").asText());
        });
    }
}
