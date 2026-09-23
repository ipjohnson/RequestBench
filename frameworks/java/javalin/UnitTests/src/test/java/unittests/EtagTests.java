package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.javalin.testtools.JavalinTest;
import io.javalin.testtools.Response;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class EtagTests extends JavalinApp {

    // rb:test etag.small,etag.large
    @ParameterizedTest
    @Tag("etag.small")
    @Tag("etag.large")
    @ValueSource(strings = {"small", "large"})
    void theAnswerCarriesAValidatorAndTheHandlerRunsEachTime(String size) {
        JavalinTest.test(app(), (server, client) -> {
            Response first = client.get("/etag/" + size);
            Response second = client.get("/etag/" + size);

            assertNotNull(Answer.header(second, "etag"));
            Answer.is(Expected.json("items." + size + ".json"), second);
            assertTrue(Answer.serial(second) > Answer.serial(first));
        });
    }

    // rb:test etag.match_large
    @Test
    @Tag("etag.match_large")
    void theValidatorItIssuedIsAnswered304WithNoBody() {
        JavalinTest.test(app(), (server, client) -> {
            String tag = Answer.header(client.get("/etag/large"), "etag");

            Response response = client.get("/etag/large", request -> request.header("if-none-match", tag));

            assertEquals(304, response.code());
            assertEquals("", response.body().string());
        });
    }

    // rb:test etag.stale_large
    @Test
    @Tag("etag.stale_large")
    void aValidatorItNeverIssuedIsAnsweredInFull() {
        JavalinTest.test(app(), (server, client) -> {
            Response response = client.get("/etag/large", request -> request.header("if-none-match", Expected.settings().get("staleEtag").asText()));

            assertEquals(200, response.code());
            Answer.is(Expected.json("items.large.json"), response);
        });
    }

    @Test
    void aRouteOutsideEtagGetsNoValidator() {
        JavalinTest.test(app(), (server, client) -> assertNull(Answer.header(client.get("/json/large"), "etag")));
    }
}
