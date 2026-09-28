package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static unittests.Http.get;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.response.Response;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

@QuarkusTest
class CacheTests {

    // rb:test cache.small,cache.medium,cache.large
    @ParameterizedTest
    @Tag("cache.small")
    @Tag("cache.medium")
    @Tag("cache.large")
    @ValueSource(strings = {"small", "medium", "large"})
    void aSecondRequestForAKeyIsItsStoredAnswer(String size) {
        String first = Answer.serial(get("/cache/" + size + "/k1"));
        Response second = get("/cache/" + size + "/k1");

        Answer.is(Expected.json("items." + size + ".json"), second);
        assertEquals(first, Answer.serial(second));
        assertNotEquals(first, Answer.serial(get("/cache/" + size + "/k2")));
    }

    // rb:test cache.vary_one
    @Test
    @Tag("cache.vary_one")
    void oneVaryHeaderKeysTheStore() {
        String alpha = Answer.serial(get("/cache/vary/one/k1", "x-rb-tenant", "alpha"));
        String beta = Answer.serial(get("/cache/vary/one/k1", "x-rb-tenant", "beta"));

        assertEquals(alpha, Answer.serial(get("/cache/vary/one/k1", "x-rb-tenant", "alpha")));
        assertNotEquals(alpha, beta);
    }

    // rb:test cache.vary_many
    @Test
    @Tag("cache.vary_many")
    void eachOfThreeVaryHeadersKeysTheStore() {
        String[] webEuAlpha = {"x-rb-channel", "web", "x-rb-region", "eu", "x-rb-tenant", "alpha"};
        String[] webEuBeta = {"x-rb-channel", "web", "x-rb-region", "eu", "x-rb-tenant", "beta"};

        String first = Answer.serial(get("/cache/vary/many/k1", webEuAlpha));

        assertEquals(first, Answer.serial(get("/cache/vary/many/k1", webEuAlpha)));
        assertNotEquals(first, Answer.serial(get("/cache/vary/many/k1", webEuBeta)));
    }

    @Test
    void theAnswerSaysWhatItVariesOn() {
        assertEquals("x-rb-channel, x-rb-region, x-rb-tenant", get("/cache/vary/many/k1").header("vary"));
    }

    @Test
    void aRequestWithoutTheVaryHeaderIsAKeyOfItsOwn() {
        String none = Answer.serial(get("/cache/vary/one/k1"));

        assertEquals(none, Answer.serial(get("/cache/vary/one/k1")));
        assertNotEquals(none, Answer.serial(get("/cache/vary/one/k1", "x-rb-tenant", "gamma")));
    }
}
