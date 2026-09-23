package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.Map;
import java.util.Set;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.javalin.testtools.JavalinTest;
import io.javalin.testtools.Response;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class BodyTests extends JavalinApp {

    // rb:test body.bind_small,body.bind_medium,body.validate_small,body.validate_medium
    @ParameterizedTest
    @Tag("body.bind_small")
    @Tag("body.bind_medium")
    @Tag("body.validate_small")
    @Tag("body.validate_medium")
    @CsvSource({
        "/body/bind/small, order.small.json",
        "/body/bind/medium, order.medium.json",
        "/body/validate/small, order.small.json",
        "/body/validate/medium, order.medium.json",
    })
    void anOrderIsAnsweredWithItsLeavesItsLengthAndItself(String path, String file) {
        String body = Expected.text(file);

        JavalinTest.test(app(), (server, client) -> {
            Response response = client.post(path, body);

            JsonNode order = Expected.json(file);
            ObjectNode bound = Expected.JSON.createObjectNode();
            bound.put("fields", 2 + 2 * order.get("lines").size());
            bound.put("bytes", Expected.bytes(file).length);
            bound.set("echo", order);
            assertEquals(200, response.code());
            Answer.is(bound, response);
        });
    }

    // rb:test body.rejected_all
    @Test
    @Tag("body.rejected_all")
    void theValidatorRefusesOrderInvalidNamingEveryFieldItBreaks() {
        JavalinTest.test(app(), (server, client) -> {
            Response response = client.post("/body/validate/small", Expected.text("order.invalid.json"));

            assertEquals(400, response.code());
            assertEquals(Set.of("customerId", "status", "lines"), Set.copyOf(named(response)));
        });
    }

    // rb:test body.rejected_first
    @Test
    @Tag("body.rejected_first")
    void theFirstErrorRouteStopsAtCustomerId() {
        JavalinTest.test(app(), (server, client) -> {
            Response response = client.post("/body/validate/first-error", Expected.text("order.invalid.json"));

            assertEquals(400, response.code());
            assertEquals(List.of("customerId"), named(response));
        });
    }

    @Test
    void theFirstErrorRouteGoesOnToStatusOnceCustomerIdPasses() {
        JavalinTest.test(app(), (server, client) ->
            assertEquals(List.of("status"), named(client.post("/body/validate/first-error", "{\"customerId\":1,\"status\":\"\",\"lines\":[]}"))));
    }

    @Test
    void aBadLineIsFiledUnderLines() {
        String body = "{\"customerId\":1,\"status\":\"open\",\"lines\":[{\"productId\":1,\"qty\":0}]}";

        JavalinTest.test(app(), (server, client) -> assertEquals(List.of("lines"), named(client.post("/body/validate/small", body))));
    }

    @Test
    void aValueOfTheWrongTypeFailsTheMapperUnderRequestBody() {
        JavalinTest.test(app(), (server, client) -> {
            Response response = client.post("/body/validate/first-error", "{\"customerId\":\"not-an-int\",\"status\":42,\"lines\":\"nope\"}");

            assertEquals(400, response.code());
            assertEquals(List.of("REQUEST_BODY"), named(response));
        });
    }

    /** The fields Javalin filed a failed check under, in the order it wrote them. */
    private static List<String> named(Response response) throws Exception {
        return Answer.json(response).properties().stream().map(Map.Entry::getKey).toList();
    }
}
