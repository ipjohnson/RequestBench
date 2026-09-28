package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import io.javalin.testtools.HttpClient;
import io.javalin.testtools.JavalinTest;
import io.javalin.testtools.Response;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class CacheTests extends JavalinApp {

    // rb:test cache.small,cache.medium,cache.large
    @ParameterizedTest
    @Tag("cache.small")
    @Tag("cache.medium")
    @Tag("cache.large")
    @ValueSource(strings = {"small", "medium", "large"})
    void aSecondRequestForAKeyIsItsStoredAnswer(String size) {
        JavalinTest.test(app(), (server, client) -> {
            String first = Answer.serial(client.get("/cache/" + size + "/k1"));
            Response second = client.get("/cache/" + size + "/k1");

            Answer.is(Expected.json("items." + size + ".json"), second);
            assertEquals(first, Answer.serial(second));
            assertNotEquals(first, Answer.serial(client.get("/cache/" + size + "/k2")));
        });
    }

    // rb:test cache.vary_one
    @Test
    @Tag("cache.vary_one")
    void oneHeaderKeysTheStore() {
        JavalinTest.test(app(), (server, client) -> {
            String alpha = get(client, "/cache/vary/one/k1", "x-rb-tenant", "alpha");
            String beta = get(client, "/cache/vary/one/k1", "x-rb-tenant", "beta");

            assertEquals(alpha, get(client, "/cache/vary/one/k1", "x-rb-tenant", "alpha"));
            assertNotEquals(alpha, beta);
        });
    }

    // rb:test cache.vary_many
    @Test
    @Tag("cache.vary_many")
    void eachOfThreeHeadersKeysTheStore() {
        String[] webEuAlpha = {"x-rb-channel", "web", "x-rb-region", "eu", "x-rb-tenant", "alpha"};
        String[] webEuBeta = {"x-rb-channel", "web", "x-rb-region", "eu", "x-rb-tenant", "beta"};

        JavalinTest.test(app(), (server, client) -> {
            String first = get(client, "/cache/vary/many/k1", webEuAlpha);

            assertEquals(first, get(client, "/cache/vary/many/k1", webEuAlpha));
            assertNotEquals(first, get(client, "/cache/vary/many/k1", webEuBeta));
        });
    }

    @Test
    void theAnswerAndItsReplaySayWhatTheyVaryOn() {
        JavalinTest.test(app(), (server, client) -> {
            assertEquals("x-rb-channel, x-rb-region, x-rb-tenant", Answer.header(client.get("/cache/vary/many/k1"), "vary"));
            assertEquals("x-rb-channel, x-rb-region, x-rb-tenant", Answer.header(client.get("/cache/vary/many/k1"), "vary"));
        });
    }

    /** The serial of the answer to a GET with each pair of strings as a header. */
    private static String get(HttpClient client, String path, String... headers) {
        return Answer.serial(client.get(path, request -> {
            for (int i = 0; i < headers.length; i += 2) {
                request.header(headers[i], headers[i + 1]);
            }
        }));
    }
}
