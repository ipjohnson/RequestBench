package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.http.HttpResponse;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

class AuthorizedTests extends MicronautApp {

    // rb:test authorized.allowed
    @Test
    @Tag("authorized.allowed")
    void theSettingsTokenIsLetThrough() throws Exception {
        HttpResponse<byte[]> response = get("/authorized/small", "authorization", "Bearer " + Expected.settings().get("token").getStringValue());

        assertEquals(200, response.statusCode());
        Answer.is(Expected.json("items.small.json"), response);
    }

    // rb:test authorized.denied
    @Test
    @Tag("authorized.denied")
    void aTokenOneCharacterOffIsForbidden() throws Exception {
        HttpResponse<byte[]> response = get("/authorized/small", "authorization", "Bearer " + Expected.settings().get("wrongToken").getStringValue());

        assertEquals(403, response.statusCode());
        assertEquals("Forbidden", Answer.json(response).get("message").getStringValue());
    }

    @Test
    void noTokenIsUnauthorized() throws Exception {
        assertEquals(401, get("/authorized/small").statusCode());
    }

    /** micronaut-security refuses every route no rule allows, so a route it ran on would answer 401. */
    @Test
    void securityRunsOnAuthorizedAlone() throws Exception {
        assertEquals(200, get("/json/small").statusCode());
    }
}
