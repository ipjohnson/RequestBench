package unittests;

import static unittests.Http.get;

import com.fasterxml.jackson.databind.node.ObjectNode;
import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@QuarkusTest
class ParametersTests {

    // rb:test parameters.static
    @Test
    @Tag("parameters.static")
    void theLiteralSegmentWinsOverACapture() {
        Answer.is(Expected.json("items.small.json"), get("/parameters/static/segment/literal"));
    }

    // rb:test parameters.one
    @Test
    @Tag("parameters.one")
    void oneCaptureIsBoundAsAnInteger() {
        ObjectNode echo = Expected.JSON.createObjectNode().put("one", 4821);

        Answer.is(Expected.withEcho("items.small.json", echo), get("/parameters/4821/segment/literal"));
    }

    // rb:test parameters.two
    @Test
    @Tag("parameters.two")
    void twoCapturesAreBoundAsIntegers() {
        ObjectNode echo = Expected.JSON.createObjectNode().put("one", 4821).put("two", 7390);

        Answer.is(Expected.withEcho("items.small.json", echo), get("/parameters/4821/with-second/7390"));
    }
}
