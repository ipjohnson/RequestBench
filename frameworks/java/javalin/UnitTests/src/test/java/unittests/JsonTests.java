package unittests;

import io.javalin.testtools.JavalinTest;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class JsonTests extends JavalinApp {

    // rb:test json.small,json.medium,json.large
    @ParameterizedTest
    @Tag("json.small")
    @Tag("json.medium")
    @Tag("json.large")
    @ValueSource(strings = {"small", "medium", "large"})
    void thePayloadIsSerialisedWhole(String size) {
        JavalinTest.test(app(), (server, client) -> Answer.is(Expected.json("items." + size + ".json"), client.get("/json/" + size)));
    }
}
