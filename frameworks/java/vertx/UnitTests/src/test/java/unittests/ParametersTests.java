package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import io.vertx.core.json.JsonObject;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

class ParametersTests extends VertxApp {

    // rb:test parameters.static
    @Test
    @Tag("parameters.static")
    void theLiteralSegmentWinsOverACapture() throws Exception {
        Answer.is(Expected.json("items.small.json"), get("/parameters/static/segment/literal"));
    }

    // rb:test parameters.one
    @Test
    @Tag("parameters.one")
    void oneCaptureIsBoundAsAnInteger() throws Exception {
        Answer.is(Expected.withEcho("items.small.json", new JsonObject().put("one", 4821)), get("/parameters/4821/segment/literal"));
    }

    // rb:test parameters.two
    @Test
    @Tag("parameters.two")
    void twoCapturesAreBoundAsIntegers() throws Exception {
        JsonObject echo = new JsonObject().put("one", 4821).put("two", 7390);

        Answer.is(Expected.withEcho("items.small.json", echo), get("/parameters/4821/with-second/7390"));
    }

    @Test
    void aCaptureThatIsNotAnIntegerIsRefusedByTheValidationHandler() throws Exception {
        assertEquals(400, get("/parameters/abc/segment/literal").statusCode());
    }
}
