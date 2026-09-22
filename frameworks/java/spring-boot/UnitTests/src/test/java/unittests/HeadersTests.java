package unittests;

import java.net.http.HttpRequest;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import tools.jackson.databind.node.ObjectNode;

class HeadersTests extends SpringApp {

    // rb:test headers.few,headers.many
    @ParameterizedTest
    @Tag("headers.few")
    @Tag("headers.many")
    @ValueSource(ints = {0, 25})
    void headersNothingReadsLeaveTheAnswerAlone(int unread) throws Exception {
        Answer.is(Expected.json("items.small.json"), send(bound(request("/headers"), unread)));
    }

    // rb:test headers.bind_few,headers.bind_many
    @ParameterizedTest
    @Tag("headers.bind_few")
    @Tag("headers.bind_many")
    @ValueSource(ints = {0, 25})
    void threeHeadersAreBoundAndEchoedOneAsAnInteger(int unread) throws Exception {
        ObjectNode echo = Expected.JSON.createObjectNode().put("tenant", "qwertyuiopas").put("requestId", "0123456789abcdef").put("account", 482913);

        Answer.is(Expected.withEcho("items.small.json", echo), send(bound(request("/headers/bind"), unread)));
    }

    /**
     * The three headers the binding rows bind, and as many more as asked that nothing reads. The
     * many rows send twenty-five of those.
     */
    private static HttpRequest.Builder bound(HttpRequest.Builder request, int unread) {
        request.header("x-rb-tenant", "qwertyuiopas").header("x-rb-request-id", "0123456789abcdef").header("x-rb-account", "482913");
        for (int i = 0; i < unread; i++) {
            request.header("x-rb-unread-" + i, "unread");
        }
        return request.GET();
    }
}
