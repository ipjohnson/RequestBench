package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.regex.Pattern;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

class CorsTests extends VertxApp {

    private static final String ORIGIN = Expected.settings().getJsonObject("cors").getString("origin");

    // rb:test cors.preflight
    @Test
    @Tag("cors.preflight")
    void theCorsHandlerAnswersAPreflightBeforeAnyHandler() throws Exception {
        HttpResponse<byte[]> response = preflight(ORIGIN);

        assertEquals(204, response.statusCode());
        assertEquals(ORIGIN, Answer.header(response, "access-control-allow-origin"));
        assertEquals("x-rb-tenant", Answer.header(response, "access-control-allow-headers"));
        assertEquals("600", Answer.header(response, "access-control-max-age"));
        assertNull(Answer.header(response, "x-rb-serial"));
    }

    // rb:test cors.disallowed
    @Test
    @Tag("cors.disallowed")
    void aPreflightFromAnotherOriginIsRefused() throws Exception {
        HttpResponse<byte[]> response = preflight("https://elsewhere.example.net");

        assertEquals(403, response.statusCode());
        assertNull(Answer.header(response, "access-control-allow-origin"));
    }

    // rb:test cors.request,cors.vary
    @Test
    @Tag("cors.request")
    @Tag("cors.vary")
    void theRequestItselfReachesTheHandlerAndVariesOnOrigin() throws Exception {
        HttpResponse<byte[]> response = get("/cors/small", "origin", ORIGIN, "x-rb-tenant", "qwertyuiopas");

        Answer.is(Expected.json("items.small.json"), response);
        assertEquals(ORIGIN, Answer.header(response, "access-control-allow-origin"));
        assertTrue(Pattern.compile("(^|,)\\s*origin\\s*(,|$)", Pattern.CASE_INSENSITIVE).matcher(String.join(",", response.headers().allValues("vary"))).find());
        assertNotNull(Answer.header(response, "x-rb-serial"));
    }

    // rb:test cors.scoped
    @Test
    @Tag("cors.scoped")
    void aRouteOutsideCorsGetsNoPolicy() throws Exception {
        assertNull(Answer.header(get("/json/small", "origin", ORIGIN), "access-control-allow-origin"));
    }

    private HttpResponse<byte[]> preflight(String origin) throws Exception {
        return send(request("/cors/small", "origin", origin, "access-control-request-method", "GET", "access-control-request-headers", "x-rb-tenant")
            .method("OPTIONS", HttpRequest.BodyPublishers.noBody()));
    }
}
