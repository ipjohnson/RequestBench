package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.http.HttpResponse;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class EtagTests extends VertxApp {

    // rb:test etag.small,etag.large
    @ParameterizedTest
    @Tag("etag.small")
    @Tag("etag.large")
    @ValueSource(strings = {"small", "large"})
    void theAnswerCarriesAValidatorAndTheHandlerRunsEachTime(String size) throws Exception {
        HttpResponse<byte[]> first = get("/etag/" + size);
        HttpResponse<byte[]> second = get("/etag/" + size);

        assertNotNull(Answer.header(second, "etag"));
        Answer.is(Expected.json("items." + size + ".json"), second);
        assertTrue(Answer.serial(second) > Answer.serial(first));
    }

    // rb:test etag.match_large
    @Test
    @Tag("etag.match_large")
    void theValidatorItIssuedIsAnswered304WithNoBody() throws Exception {
        String tag = Answer.header(get("/etag/large"), "etag");

        HttpResponse<byte[]> response = get("/etag/large", "if-none-match", tag);

        assertEquals(304, response.statusCode());
        assertEquals(0, response.body().length);
    }

    // rb:test etag.stale_large
    @Test
    @Tag("etag.stale_large")
    void aValidatorItNeverIssuedIsAnsweredInFull() throws Exception {
        HttpResponse<byte[]> response = get("/etag/large", "if-none-match", Expected.settings().getString("staleEtag"));

        assertEquals(200, response.statusCode());
        Answer.is(Expected.json("items.large.json"), response);
    }
}
