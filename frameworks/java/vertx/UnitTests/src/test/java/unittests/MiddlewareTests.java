package unittests;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class MiddlewareTests extends VertxApp {

    // rb:test middleware.none,middleware.four,middleware.sixteen
    @ParameterizedTest
    @Tag("middleware.none")
    @Tag("middleware.four")
    @Tag("middleware.sixteen")
    @ValueSource(strings = {"none", "four", "sixteen"})
    void everyLayerPassesTheRequestThrough(String layers) throws Exception {
        Answer.is(Expected.json("items.small.json"), get("/middleware/" + layers));
    }
}
