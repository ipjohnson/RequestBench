package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import java.util.Arrays;
import java.util.Set;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class CacheTests extends HelidonApp {

    // rb:test cache.small,cache.medium,cache.large
    @ParameterizedTest
    @Tag("cache.small")
    @Tag("cache.medium")
    @Tag("cache.large")
    @ValueSource(strings = {"small", "medium", "large"})
    void aSecondRequestForAKeyIsItsStoredAnswer(String size) throws Exception {
        String first = Answer.serial(get("/cache/" + size + "/k1"));
        var second = get("/cache/" + size + "/k1");

        Answer.is(Expected.json("items." + size + ".json"), second);
        assertEquals(first, Answer.serial(second));
        assertNotEquals(first, Answer.serial(get("/cache/" + size + "/k2")));
    }

    // rb:test cache.vary_one
    @Test
    @Tag("cache.vary_one")
    void oneVaryHeaderKeysTheStore() throws Exception {
        String alpha = Answer.serial(get("/cache/vary/one/k1", "x-rb-tenant", "alpha"));
        String beta = Answer.serial(get("/cache/vary/one/k1", "x-rb-tenant", "beta"));

        assertEquals(alpha, Answer.serial(get("/cache/vary/one/k1", "x-rb-tenant", "alpha")));
        assertNotEquals(alpha, beta);
    }

    // rb:test cache.vary_many
    @Test
    @Tag("cache.vary_many")
    void eachOfThreeVaryHeadersKeysTheStore() throws Exception {
        String[] webEuAlpha = {"x-rb-channel", "web", "x-rb-region", "eu", "x-rb-tenant", "alpha"};
        String[] webEuBeta = {"x-rb-channel", "web", "x-rb-region", "eu", "x-rb-tenant", "beta"};

        String first = Answer.serial(get("/cache/vary/many/k1", webEuAlpha));

        assertEquals(first, Answer.serial(get("/cache/vary/many/k1", webEuAlpha)));
        assertNotEquals(first, Answer.serial(get("/cache/vary/many/k1", webEuBeta)));
    }

    @Test
    void theAnswerSaysWhatItVariesOn() throws Exception {
        String vary = Answer.header(get("/cache/vary/many/k1"), "vary");

        assertEquals(Set.of("x-rb-channel", "x-rb-region", "x-rb-tenant"), Set.of(vary.split(",\\s*")));
    }
}
