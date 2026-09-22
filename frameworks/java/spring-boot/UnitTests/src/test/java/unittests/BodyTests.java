package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

class BodyTests extends SpringApp {

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

        JsonNode order = Expected.json(file);
        ObjectNode bound = Expected.JSON.createObjectNode();
        bound.put("fields", 2 + 2 * order.get("lines").size());
        bound.put("bytes", body.length);
        bound.set("echo", order);
        assertEquals(200, response.statusCode());
        Answer.is(bound, response);
    }

    // rb:test body.rejected_all
    @Test
    @Tag("body.rejected_all")
    void beanValidationRefusesOrderInvalidNamingEveryRuleItBreaks() throws Exception {
        HttpResponse<byte[]> response = send("POST", "/body/validate/small", "application/json", Expected.bytes("order.invalid.json"));

        assertEquals(400, response.statusCode());
        assertEquals(Set.of("customerId", "status", "lines"), Set.copyOf(named(response)));
    }

    // rb:test body.rejected_first
    @Test
    @Tag("body.rejected_first")
    void theFirstErrorRouteStopsAtCustomerId() throws Exception {
        HttpResponse<byte[]> response = send("POST", "/body/validate/first-error", "application/json", Expected.bytes("order.invalid.json"));

        assertEquals(400, response.statusCode());
        assertEquals(List.of("customerId"), named(response));
    }

    @Test
    void theGroupSequenceGoesOnToStatusOnceCustomerIdPasses() throws Exception {
        byte[] body = "{\"customerId\":1,\"status\":\"\",\"lines\":[]}".getBytes(StandardCharsets.UTF_8);

        assertEquals(List.of("status"), named(send("POST", "/body/validate/first-error", "application/json", body)));
    }

    @Test
    void aBadLineIsNamedByItsIndex() throws Exception {
        byte[] body = "{\"customerId\":1,\"status\":\"open\",\"lines\":[{\"productId\":1,\"qty\":0}]}".getBytes(StandardCharsets.UTF_8);

        assertEquals(List.of("lines[0].qty"), named(send("POST", "/body/validate/small", "application/json", body)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"/body/validate/small", "/body/validate/first-error"})
    void jacksonRefusesAValueOfTheWrongTypeBeforeValidationAndNamesNoField(String path) throws Exception {
        byte[] body = "{\"customerId\":\"not-an-int\",\"status\":42,\"lines\":\"nope\"}".getBytes(StandardCharsets.UTF_8);

        HttpResponse<byte[]> response = send("POST", path, "application/json", body);

        assertEquals(400, response.statusCode());
        assertNull(Answer.json(response).get("errors"));
    }

    private static List<String> named(HttpResponse<byte[]> response) {
        return Answer.json(response).get("errors").valueStream().map(e -> e.get("field").asString()).collect(Collectors.toList());
    }
}
