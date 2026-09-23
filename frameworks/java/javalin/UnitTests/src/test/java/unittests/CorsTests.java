package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.regex.Pattern;

import io.javalin.testtools.HttpClient;
import io.javalin.testtools.JavalinTest;
import io.javalin.testtools.Response;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

class CorsTests extends JavalinApp {

    private static final String ORIGIN = Expected.settings().get("cors").get("origin").asText();

    private static final Pattern VARY_ORIGIN = Pattern.compile("(^|,)\\s*origin\\s*(,|$)", Pattern.CASE_INSENSITIVE);

    // rb:test cors.preflight
    @Test
    @Tag("cors.preflight")
    void thePluginAnswersAPreflightAndNoRouteRuns() {
        JavalinTest.test(app(), (server, client) -> {
            HttpResponse<byte[]> response = preflight(client, ORIGIN);

            assertEquals(200, response.statusCode());
            assertEquals(ORIGIN, Answer.header(response, "access-control-allow-origin"));
            assertEquals("x-rb-tenant", Answer.header(response, "access-control-allow-headers"));
            assertEquals("600", Answer.header(response, "access-control-max-age"));
            assertNull(Answer.header(response, "x-rb-serial"));
        });
    }

    // rb:test cors.disallowed
    @Test
    @Tag("cors.disallowed")
    void aPreflightFromAnotherOriginIsNotAllowed() {
        JavalinTest.test(app(), (server, client) ->
            assertNull(Answer.header(preflight(client, "https://elsewhere.example.net"), "access-control-allow-origin")));
    }

    // rb:test cors.request,cors.vary
    @Test
    @Tag("cors.request")
    @Tag("cors.vary")
    void theRequestItselfReachesTheRouteAndVariesOnOrigin() {
        JavalinTest.test(app(), (server, client) -> {
            Response response = client.get("/cors/small", request -> request.header("origin", ORIGIN).header("x-rb-tenant", "qwertyuiopas"));

            Answer.is(Expected.json("items.small.json"), response);
            assertEquals(ORIGIN, Answer.header(response, "access-control-allow-origin"));
            assertTrue(VARY_ORIGIN.matcher(String.join(",", response.headers().get("vary"))).find());
            assertNotNull(Answer.header(response, "x-rb-serial"));
        });
    }

    // rb:test cors.scoped
    @Test
    @Tag("cors.scoped")
    void aRouteOutsideCorsGetsNoPolicy() {
        JavalinTest.test(app(), (server, client) ->
            assertNull(Answer.header(client.get("/json/small", request -> request.header("origin", ORIGIN)), "access-control-allow-origin")));
    }

    private static HttpResponse<byte[]> preflight(HttpClient client, String origin) throws Exception {
        return send(request(client, "/cors/small",
                "origin", origin, "access-control-request-method", "GET", "access-control-request-headers", "x-rb-tenant")
            .method("OPTIONS", HttpRequest.BodyPublishers.noBody()));
    }
}
