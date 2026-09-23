package unittests;

import io.javalin.testtools.JavalinTest;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class MiddlewareTests extends JavalinApp {

    // rb:test middleware.none,middleware.four,middleware.sixteen
    @ParameterizedTest
    @Tag("middleware.none")
    @Tag("middleware.four")
    @Tag("middleware.sixteen")
    @ValueSource(strings = {"none", "four", "sixteen"})
    void everyLayerLetsTheRequestThrough(String layers) {
        JavalinTest.test(app(), (server, client) -> Answer.is(Expected.json("items.small.json"), client.get("/middleware/" + layers)));
    }
}
