package unittests;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

class ParametersTests extends MicronautApp {

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
        Answer.is(Expected.withEcho("items.small.json", Expected.object("one", 4821)), get("/parameters/4821/segment/literal"));
    }

    // rb:test parameters.two
    @Test
    @Tag("parameters.two")
    void twoCapturesAreBoundAsIntegers() throws Exception {
        Answer.is(Expected.withEcho("items.small.json", Expected.object("one", 4821, "two", 7390)), get("/parameters/4821/with-second/7390"));
    }
}
