package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.node.ObjectNode;
import io.javalin.testtools.JavalinTest;
import io.javalin.testtools.Response;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

class ParametersTests extends JavalinApp {

    // rb:test parameters.static
    @Test
    @Tag("parameters.static")
    void theLiteralSegmentWinsOverACapture() {
        JavalinTest.test(app(), (server, client) ->
            Answer.is(Expected.json("items.small.json"), client.get("/parameters/static/segment/literal")));
    }

    // rb:test parameters.one
    @Test
    @Tag("parameters.one")
    void oneCaptureIsReadAsAnInteger() {
        ObjectNode echo = Expected.JSON.createObjectNode().put("one", 4821);

        JavalinTest.test(app(), (server, client) ->
            Answer.is(Expected.withEcho("items.small.json", echo), client.get("/parameters/4821/segment/literal")));
    }

    // rb:test parameters.two
    @Test
    @Tag("parameters.two")
    void twoCapturesAreReadAsIntegers() {
        ObjectNode echo = Expected.JSON.createObjectNode().put("one", 4821).put("two", 7390);

        JavalinTest.test(app(), (server, client) ->
            Answer.is(Expected.withEcho("items.small.json", echo), client.get("/parameters/4821/with-second/7390")));
    }

    @Test
    void aCaptureThatIsNotAnIntegerIsRefusedByTheValidator() {
        JavalinTest.test(app(), (server, client) -> {
            Response response = client.get("/parameters/abc/segment/literal");

            assertEquals(400, response.code());
            assertEquals("TYPE_CONVERSION_FAILED", Answer.json(response).get("one").get(0).get("message").asText());
        });
    }
}
