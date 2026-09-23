package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.http.HttpResponse;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

class AuthorizedTests extends HelidonApp {

    // rb:test authorized.allowed
    @Test
    @Tag("authorized.allowed")
    void theSettingsTokenIsLetThrough() throws Exception {
        HttpResponse<byte[]> response = get("/authorized/small", "authorization", "Bearer " + Expected.settings().get("token").asText());

        assertEquals(200, response.statusCode());
        Answer.is(Expected.json("items.small.json"), response);
    }

    // rb:test authorized.denied
    @Test
    @Tag("authorized.denied")
    void aTokenOneCharacterOffIsAuthenticatedAndThenForbidden() throws Exception {
        HttpResponse<byte[]> response = get("/authorized/small", "authorization", "Bearer " + Expected.settings().get("wrongToken").asText());

        assertEquals(403, response.statusCode());
        assertEquals(0, response.body().length);
    }

    @Test
    void noTokenFailsAuthenticationWith401() throws Exception {
        assertEquals(401, get("/authorized/small").statusCode());
    }
}
