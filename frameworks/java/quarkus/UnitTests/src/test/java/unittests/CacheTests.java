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
    void aSecondRequestIsTheStoredAnswer(String size) {
        long first = Answer.serial(get("/cache/" + size));
        Response second = get("/cache/" + size);

        Answer.is(Expected.json("items." + size + ".json"), second);
        assertEquals(first, Answer.serial(second));
    }

    // rb:test cache.vary_one
    @Test
    @Tag("cache.vary_one")
    void oneVaryHeaderKeysTheStore() {
        long alpha = Answer.serial(get("/cache/vary/one", "x-rb-tenant", "alpha"));
        long beta = Answer.serial(get("/cache/vary/one", "x-rb-tenant", "beta"));

        assertEquals(alpha, Answer.serial(get("/cache/vary/one", "x-rb-tenant", "alpha")));
        assertNotEquals(alpha, beta);
    }

    // rb:test cache.vary_many
    @Test
    @Tag("cache.vary_many")
    void eachOfThreeVaryHeadersKeysTheStore() {
        String[] webEuAlpha = {"x-rb-channel", "web", "x-rb-region", "eu", "x-rb-tenant", "alpha"};
        String[] webEuBeta = {"x-rb-channel", "web", "x-rb-region", "eu", "x-rb-tenant", "beta"};

        long first = Answer.serial(get("/cache/vary/many", webEuAlpha));

        assertEquals(first, Answer.serial(get("/cache/vary/many", webEuAlpha)));
        assertNotEquals(first, Answer.serial(get("/cache/vary/many", webEuBeta)));
    }

    @Test
    void theAnswerSaysWhatItVariesOn() {
        assertEquals("x-rb-channel, x-rb-region, x-rb-tenant", get("/cache/vary/many").header("vary"));
    }

    @Test
    void aRequestWithoutTheVaryHeaderIsAKeyOfItsOwn() {
        long none = Answer.serial(get("/cache/vary/one"));

        assertEquals(none, Answer.serial(get("/cache/vary/one")));
        assertNotEquals(none, Answer.serial(get("/cache/vary/one", "x-rb-tenant", "gamma")));
    }
}
