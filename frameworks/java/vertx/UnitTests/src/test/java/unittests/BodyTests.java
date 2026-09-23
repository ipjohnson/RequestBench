package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;

import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class BodyTests extends VertxApp {

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
    void anOrderIsAnsweredWithItsLeavesItsLengthAndItself(String path, String file) throws Exception {
        byte[] body = Expected.bytes(file);

        HttpResponse<byte[]> response = send("POST", path, "application/json", body);

        JsonObject order = Expected.json(file);
        JsonObject bound = new JsonObject()
            .put("fields", 2 + 2 * order.getJsonArray("lines").size())
            .put("bytes", body.length)
            .put("echo", order);
        assertEquals(200, response.statusCode());
        Answer.is(bound, response);
    }

    // rb:test body.rejected_all
    @Test
    @Tag("body.rejected_all")
    void theSchemaRefusesOrderInvalidNamingEveryRuleItBreaks() throws Exception {
        HttpResponse<byte[]> response = send("POST", "/body/validate/small", "application/json", Expected.bytes("order.invalid.json"));

        assertEquals(400, response.statusCode());
        assertEquals("VALIDATION_ERROR", Answer.json(response).getString("errorType"));
        assertEquals(Set.of("#/customerId", "#/status", "#/lines"), Set.copyOf(named(response)));
    }

    // rb:test body.rejected_first
    @Test
    @Tag("body.rejected_first")
    void theFirstErrorRouteStopsAtCustomerId() throws Exception {
        HttpResponse<byte[]> response = send("POST", "/body/validate/first-error", "application/json", Expected.bytes("order.invalid.json"));

        assertEquals(400, response.statusCode());
        assertEquals(List.of("#/customerId"), named(response));
    }

    @Test
    void theFirstErrorRouteGoesOnToStatusOnceCustomerIdPasses() throws Exception {
        byte[] body = "{\"customerId\":1,\"status\":\"\",\"lines\":[]}".getBytes(StandardCharsets.UTF_8);

        assertEquals(List.of("#/status"), named(send("POST", "/body/validate/first-error", "application/json", body)));
    }

    @Test
    void aBadLineIsNamedByItsPointer() throws Exception {
        byte[] body = "{\"customerId\":1,\"status\":\"open\",\"lines\":[{\"productId\":1,\"qty\":0}]}".getBytes(StandardCharsets.UTF_8);

        assertEquals(List.of("#/lines", "#/lines/0/qty"), named(send("POST", "/body/validate/small", "application/json", body)));
    }

    @Test
    void aValueOfTheWrongTypeIsASchemaFailureThatNamesItsField() throws Exception {
        byte[] body = "{\"customerId\":\"not-an-int\",\"status\":42,\"lines\":\"nope\"}".getBytes(StandardCharsets.UTF_8);

        HttpResponse<byte[]> response = send("POST", "/body/validate/small", "application/json", body);

        assertEquals(400, response.statusCode());
        assertEquals(Set.of("#/customerId", "#/status", "#/lines"), Set.copyOf(named(response)));
    }

    /**
     * The values the validator's report names, by JSON pointer, in the order it lists them. The
     * report is causeMessage: a line of text around a list of the validator's errors as JSON.
     */
    private static List<String> named(HttpResponse<byte[]> response) {
        String report = Answer.json(response).getString("causeMessage");
        String errors = report.substring(report.indexOf("[", report.indexOf("{ errors: ")), report.lastIndexOf(", annotations: "));
        return new JsonArray(errors).stream().map(e -> ((JsonObject) e).getString("instanceLocation")).distinct().toList();
    }
}
