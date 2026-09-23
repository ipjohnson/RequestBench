package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import io.javalin.testtools.JavalinTest;
import io.javalin.testtools.Response;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

class AuthorizedTests extends JavalinApp {

    private static final String TOKEN = Expected.settings().get("token").asText();

    private static final String WRONG_TOKEN = Expected.settings().get("wrongToken").asText();

    // rb:test authorized.allowed
    @Test
    @Tag("authorized.allowed")
    void theSettingsTokenIsLetThrough() {
        JavalinTest.test(app(), (server, client) -> {
            Response response = client.get("/authorized/small", request -> request.header("authorization", "Bearer " + TOKEN));

            assertEquals(200, response.code());
            Answer.is(Expected.json("items.small.json"), response);
        });
    }

    // rb:test authorized.denied
    @Test
    @Tag("authorized.denied")
    void aTokenOneCharacterOffIsForbidden() {
        JavalinTest.test(app(), (server, client) -> {
            Response response = client.get("/authorized/small", request -> request.header("authorization", "Bearer " + WRONG_TOKEN));

            assertEquals(403, response.code());
            assertEquals("Forbidden", response.body().string());
        });
    }

    @Test
    void noTokenIsForbiddenToo() {
        JavalinTest.test(app(), (server, client) -> assertEquals(403, client.get("/authorized/small").code()));
    }

    @Test
    void theCheckRunsOnAuthorizedAlone() {
        JavalinTest.test(app(), (server, client) ->
            assertEquals(200, client.get("/json/small", request -> request.header("authorization", "Bearer " + WRONG_TOKEN)).code()));
    }
}
