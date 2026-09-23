package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static unittests.Http.get;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.response.Response;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

@QuarkusTest
class EtagTests {

    // rb:test etag.small,etag.large
    @ParameterizedTest
    @Tag("etag.small")
    @Tag("etag.large")
    @ValueSource(strings = {"small", "large"})
    void theAnswerCarriesAValidatorAndTheHandlerRunsEachTime(String size) {
        Response first = get("/etag/" + size);
        Response second = get("/etag/" + size);

        assertNotNull(second.header("etag"));
        Answer.is(Expected.json("items." + size + ".json"), second);
        assertTrue(Answer.serial(second) > Answer.serial(first));
    }

    // rb:test etag.match_large
    @Test
    @Tag("etag.match_large")
    void theValidatorItIssuedIsAnswered304WithNoBody() {
        String tag = get("/etag/large").header("etag");

        Response response = get("/etag/large", "if-none-match", tag);

        assertEquals(304, response.statusCode());
        assertEquals(0, response.asByteArray().length);
    }

    // rb:test etag.stale_large
    @Test
    @Tag("etag.stale_large")
    void aValidatorItNeverIssuedIsAnsweredInFull() {
        Response response = get("/etag/large", "if-none-match", Expected.settings().get("staleEtag").asText());

        assertEquals(200, response.statusCode());
        Answer.is(Expected.json("items.large.json"), response);
    }
}
