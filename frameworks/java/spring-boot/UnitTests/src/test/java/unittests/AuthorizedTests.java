package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.net.http.HttpResponse;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

class AuthorizedTests extends SpringApp {

    // rb:test authorized.allowed
    @Test
    @Tag("authorized.allowed")
    void theTokenIsLetThrough() throws Exception {
        HttpResponse<byte[]> response = get("/authorized/small", "authorization", "Bearer 5a7cc77ed0dcb825806b6f872026c317");

        assertEquals(200, response.statusCode());
        Answer.is(Expected.json("items.small.json"), response);
    }

    // rb:test authorized.denied
    @Test
    @Tag("authorized.denied")
    void aTokenOneCharacterOffIsForbidden() throws Exception {
        HttpResponse<byte[]> response = get("/authorized/small", "authorization", "Bearer 5a7cc77ed0dcb825806b6f872026c310");

        assertEquals(403, response.statusCode());
        assertEquals(403, Answer.json(response).get("status").asInt());
    }

    @Test
    void noTokenIsForbiddenToo() throws Exception {
        assertEquals(403, get("/authorized/small").statusCode());
    }

    @Test
    void springSecurityRunsOnAuthorizedAlone() throws Exception {
        assertEquals("DENY", Answer.header(get("/authorized/small"), "x-frame-options"));
        assertNull(Answer.header(get("/json/small"), "x-frame-options"));
    }
}
