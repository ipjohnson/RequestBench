package unittests;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class JsonTests extends VertxApp {

    // rb:test json.small,json.medium,json.large
    @ParameterizedTest
    @Tag("json.small")
    @Tag("json.medium")
    @Tag("json.large")
    @ValueSource(strings = {"small", "medium", "large"})
    void thePayloadIsSerialisedWhole(String size) throws Exception {
        Answer.is(Expected.json("items." + size + ".json"), get("/json/" + size));
    }
}
