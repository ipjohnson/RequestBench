package unittests;

import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

class ParametersTests extends HelidonApp {

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
        ObjectNode echo = Expected.JSON.createObjectNode().put("one", 4821);

        Answer.is(Expected.withEcho("items.small.json", echo), get("/parameters/4821/segment/literal"));
    }

    // rb:test parameters.two
    @Test
    @Tag("parameters.two")
    void twoCapturesAreBoundAsIntegers() throws Exception {
        ObjectNode echo = Expected.JSON.createObjectNode().put("one", 4821).put("two", 7390);

        Answer.is(Expected.withEcho("items.small.json", echo), get("/parameters/4821/with-second/7390"));
    }
}
