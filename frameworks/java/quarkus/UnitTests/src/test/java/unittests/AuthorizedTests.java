package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static unittests.Http.get;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.response.Response;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AuthorizedTests {

    private static final String TOKEN = Expected.settings().get("token").asText();

    // rb:test authorized.allowed
    @Test
    @Tag("authorized.allowed")
    void theSettingsTokenIsLetThrough() {
        Response response = get("/authorized/small", "authorization", "Bearer " + TOKEN);

        assertEquals(200, response.statusCode());
        Answer.is(Expected.json("items.small.json"), response);
    }

    // rb:test authorized.denied
    @Test
    @Tag("authorized.denied")
    void aTokenOneCharacterOffIsForbiddenWithNoBody() {
        Response response = get("/authorized/small", "authorization", "Bearer " + Expected.settings().get("wrongToken").asText());

        assertEquals(403, response.statusCode());
        assertEquals(0, response.asByteArray().length);
    }

    @Test
    void noTokenIsForbiddenToo() {
        assertEquals(403, get("/authorized/small").statusCode());
    }

    @Test
    void thePolicyGuardsAuthorizedAlone() {
        assertEquals(200, get("/json/small", "authorization", "Bearer wrong").statusCode());
    }
}
