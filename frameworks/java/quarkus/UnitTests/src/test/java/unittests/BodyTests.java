package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static unittests.Http.send;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.response.Response;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

@QuarkusTest
class BodyTests {

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
        byte[] body = Expected.bytes(file);

        Response response = send("POST", path, "application/json", body);

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
    void hibernateValidatorRefusesOrderInvalidNamingEveryRuleItBreaks() {
        Response response = send("POST", "/body/validate/small", "application/json", Expected.bytes("order.invalid.json"));

        assertEquals(400, response.statusCode());
        assertEquals(Set.of("validateSmall.order.customerId", "validateSmall.order.status", "validateSmall.order.lines"), Set.copyOf(named(response)));
    }

    // rb:test body.rejected_first
    @Test
    @Tag("body.rejected_first")
    void theFirstErrorRouteStopsAtCustomerId() {
        Response response = send("POST", "/body/validate/first-error", "application/json", Expected.bytes("order.invalid.json"));

        assertEquals(400, response.statusCode());
        assertEquals(List.of("validateFirstError.order.customerId"), named(response));
    }

    @Test
    void theGroupSequenceGoesOnToStatusOnceCustomerIdPasses() {
        byte[] body = "{\"customerId\":1,\"status\":\"\",\"lines\":[]}".getBytes(StandardCharsets.UTF_8);

        assertEquals(List.of("validateFirstError.order.status"), named(send("POST", "/body/validate/first-error", "application/json", body)));
    }

    @Test
    void aBadLineIsNamedByItsIndex() {
        byte[] body = "{\"customerId\":1,\"status\":\"open\",\"lines\":[{\"productId\":1,\"qty\":0}]}".getBytes(StandardCharsets.UTF_8);

        assertEquals(List.of("validateSmall.order.lines[0].qty"), named(send("POST", "/body/validate/small", "application/json", body)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"/body/validate/small", "/body/validate/first-error"})
    void jacksonRefusesAValueOfTheWrongTypeBeforeValidation(String path) {
        byte[] body = "{\"customerId\":\"not-an-int\",\"status\":42,\"lines\":\"nope\"}".getBytes(StandardCharsets.UTF_8);

        Response response = send("POST", path, "application/json", body);

        assertEquals(400, response.statusCode());
        assertFalse(response.asString().contains("violations"));
    }

    private static List<String> named(Response response) {
        List<String> fields = new ArrayList<>();
        Answer.json(response).get("violations").forEach(v -> fields.add(v.get("field").asText()));
        return fields;
    }
}
