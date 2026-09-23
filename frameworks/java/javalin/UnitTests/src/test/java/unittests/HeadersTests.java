package unittests;

import java.util.function.Consumer;

import com.fasterxml.jackson.databind.node.ObjectNode;
import io.javalin.testtools.JavalinTest;
import io.javalin.testtools.Request;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class HeadersTests extends JavalinApp {

    // rb:test headers.few,headers.many
    @ParameterizedTest
    @Tag("headers.few")
    @Tag("headers.many")
    @ValueSource(ints = {0, 25})
    void headersNothingReadsLeaveTheAnswerAlone(int unread) {
        JavalinTest.test(app(), (server, client) -> Answer.is(Expected.json("items.small.json"), client.get("/headers", bound(unread))));
    }

    // rb:test headers.bind_few,headers.bind_many
    @ParameterizedTest
    @Tag("headers.bind_few")
    @Tag("headers.bind_many")
    @ValueSource(ints = {0, 25})
    void threeHeadersAreReadAndEchoedOneAsAnInteger(int unread) {
        ObjectNode echo = Expected.JSON.createObjectNode().put("tenant", "qwertyuiopas").put("requestId", "0123456789abcdef").put("account", 482913);

        JavalinTest.test(app(), (server, client) -> Answer.is(Expected.withEcho("items.small.json", echo), client.get("/headers/bind", bound(unread))));
    }

    /**
     * The three headers the binding rows read, and as many more as asked that nothing reads. The
     * many rows send twenty-five of those.
     */
    private static Consumer<Request.Builder> bound(int unread) {
        return request -> {
            request.header("x-rb-tenant", "qwertyuiopas").header("x-rb-request-id", "0123456789abcdef").header("x-rb-account", "482913");
            for (int i = 0; i < unread; i++) {
                request.header("x-rb-unread-" + i, "unread");
            }
        };
    }
}
