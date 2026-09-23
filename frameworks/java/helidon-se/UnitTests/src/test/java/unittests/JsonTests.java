package unittests;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.helidon.webserver.WebServer;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class JsonTests extends HelidonApp {

    // rb:test json.small,json.medium,json.large
    @ParameterizedTest
    @Tag("json.small")
    @Tag("json.medium")
    @Tag("json.large")
    @ValueSource(strings = {"small", "medium", "large"})
    void thePayloadIsSerialisedWhole(String size) throws Exception {
        Answer.is(Expected.json("items." + size + ".json"), get("/json/" + size));
    }

    @Test
    void theAnswerIsChunkedAndTheSocketSendsItsLastChunkAtOnce(WebServer server) throws Exception {
        assertNull(Answer.header(get("/json/small"), "content-length"));
        assertTrue(server.prototype().connectionOptions().tcpNoDelay());
    }
}
