package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static unittests.Http.get;

import java.util.regex.Pattern;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.response.Response;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@QuarkusTest
class CorsTests {

    private static final String ORIGIN = Expected.settings().get("cors").get("origin").asText();

    // rb:test cors.preflight
    @Test
    @Tag("cors.preflight")
    void theFilterAnswersAPreflightBeforeAnyHandler() {
        Response response = preflight(ORIGIN);

        assertEquals(200, response.statusCode());
        assertEquals(ORIGIN, response.header("access-control-allow-origin"));
        assertEquals("x-rb-tenant", response.header("access-control-allow-headers"));
        assertEquals("600", response.header("access-control-max-age"));
        assertNull(response.header("x-rb-serial"));
    }

    // rb:test cors.disallowed
    @Test
    @Tag("cors.disallowed")
    void aPreflightFromAnotherOriginIsNotAllowed() {
        assertNull(preflight("https://elsewhere.example.net").header("access-control-allow-origin"));
    }

    // rb:test cors.request,cors.vary
    @Test
    @Tag("cors.request")
    @Tag("cors.vary")
    void theRequestItselfReachesTheHandlerAndVariesOnOrigin() {
        Response response = get("/cors/small", "origin", ORIGIN, "x-rb-tenant", "qwertyuiopas");

        Answer.is(Expected.json("items.small.json"), response);
        assertEquals(ORIGIN, response.header("access-control-allow-origin"));
        assertTrue(Pattern.compile("(^|,)\\s*origin\\s*(,|$)", Pattern.CASE_INSENSITIVE).matcher(String.join(",", response.headers().getValues("vary"))).find());
        assertNotNull(response.header("x-rb-serial"));
    }

    /** cors.scoped is skipped, because Quarkus's CORS filter runs on every route. */
    @Test
    void theFilterAnswersARouteOutsideCorsToo() {
        assertEquals(ORIGIN, get("/json/small", "origin", ORIGIN).header("access-control-allow-origin"));
    }

    private static Response preflight(String origin) {
        return Http.request("origin", origin, "access-control-request-method", "GET", "access-control-request-headers", "x-rb-tenant")
            .options("/cors/small");
    }
}
