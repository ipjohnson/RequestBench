package unittests;

import static unittests.Http.get;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

@QuarkusTest
class MiddlewareTests {

    // rb:test middleware.none,middleware.four,middleware.sixteen
    @ParameterizedTest
    @Tag("middleware.none")
    @Tag("middleware.four")
    @Tag("middleware.sixteen")
    @ValueSource(strings = {"none", "four", "sixteen"})
    void everyLayerPassesTheRequestThrough(String layers) {
        Answer.is(Expected.json("items.small.json"), get("/middleware/" + layers));
    }
}
