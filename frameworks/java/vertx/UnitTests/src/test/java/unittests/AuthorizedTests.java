package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.http.HttpResponse;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

class AuthorizedTests extends VertxApp {

    // rb:test authorized.allowed
    @Test
    @Tag("authorized.allowed")
    void theSettingsTokenIsLetThrough() throws Exception {
        HttpResponse<byte[]> response = get("/authorized/small", "authorization", "Bearer " + Expected.settings().getString("token"));

        assertEquals(200, response.statusCode());
        Answer.is(Expected.json("items.small.json"), response);
    }

    // rb:test authorized.denied
    @Test
    @Tag("authorized.denied")
    void aTokenOneCharacterOffIsForbiddenByTheAuthorizationHandler() throws Exception {
        HttpResponse<byte[]> response = get("/authorized/small", "authorization", "Bearer " + Expected.settings().getString("wrongToken"));

        assertEquals(403, response.statusCode());
        assertEquals("Error 403: Forbidden", Answer.text(response));
    }

    @Test
    void noTokenIsNotAuthenticated() throws Exception {
        assertEquals(401, get("/authorized/small").statusCode());
    }

    @Test
    void theHandlersRunOnAuthorizedAlone() throws Exception {
        assertEquals(200, get("/json/small", "authorization", "Bearer " + Expected.settings().getString("wrongToken")).statusCode());
    }
}
