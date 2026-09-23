package unittests;

import com.fasterxml.jackson.databind.node.ObjectNode;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.specification.RequestSpecification;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

@QuarkusTest
class HeadersTests {

    // rb:test headers.few,headers.many
    @ParameterizedTest
    @Tag("headers.few")
    @Tag("headers.many")
    @ValueSource(ints = {0, 25})
    void headersNothingReadsLeaveTheAnswerAlone(int unread) {
        Answer.is(Expected.json("items.small.json"), bound(unread).get("/headers"));
    }

    // rb:test headers.bind_few,headers.bind_many
    @ParameterizedTest
    @Tag("headers.bind_few")
    @Tag("headers.bind_many")
    @ValueSource(ints = {0, 25})
    void threeHeadersAreBoundAndEchoedOneAsAnInteger(int unread) {
        ObjectNode echo = Expected.JSON.createObjectNode().put("tenant", "qwertyuiopas").put("requestId", "0123456789abcdef").put("account", 482913);

        Answer.is(Expected.withEcho("items.small.json", echo), bound(unread).get("/headers/bind"));
    }

    /**
     * The three headers the binding rows bind, and as many more as asked that nothing reads. The
     * many rows send twenty-five of those.
     */
    private static RequestSpecification bound(int unread) {
        RequestSpecification request = Http.request("x-rb-tenant", "qwertyuiopas", "x-rb-request-id", "0123456789abcdef", "x-rb-account", "482913");
        for (int i = 0; i < unread; i++) {
            request.header("x-rb-unread-" + i, "unread");
        }
        return request;
    }
}
