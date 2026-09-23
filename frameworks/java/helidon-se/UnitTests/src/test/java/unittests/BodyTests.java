package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

class BodyTests extends HelidonApp {

    /** The record component each violation in Helidon Validation's message names last. */
    private static final Pattern COMPONENT = Pattern.compile(" at (?:[A-Z_]+\\([^)]*\\)/)*RECORD_COMPONENT\\((\\w+)\\)");

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
    void helidonValidationRefusesOrderInvalidNamingEveryRuleItBreaks() throws Exception {
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
    void theFirstErrorRouteGoesOnToStatusOnceCustomerIdPasses() throws Exception {
        byte[] body = "{\"customerId\":1,\"status\":\"\",\"lines\":[]}".getBytes(StandardCharsets.UTF_8);

        assertEquals(List.of("status"), named(send("POST", "/body/validate/first-error", "application/json", body)));
    }

    @Test
    void aBadLineIsNamedThroughTheListWithoutItsIndex() throws Exception {
        byte[] body = "{\"customerId\":1,\"status\":\"open\",\"lines\":[{\"productId\":1,\"qty\":0}]}".getBytes(StandardCharsets.UTF_8);

        HttpResponse<byte[]> response = send("POST", "/body/validate/small", "application/json", body);

        assertEquals(List.of("qty"), named(response));
        assertTrue(Answer.json(response).get("error").asText().contains("RECORD_COMPONENT(lines)/ELEMENT(element)/"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"/body/validate/small", "/body/validate/first-error"})
    void helidonJsonBindingRefusesAValueOfTheWrongTypeBeforeValidation(String path) throws Exception {
        byte[] body = "{\"customerId\":\"not-an-int\",\"status\":42,\"lines\":\"nope\"}".getBytes(StandardCharsets.UTF_8);

        HttpResponse<byte[]> response = send("POST", path, "application/json", body);

        assertEquals(400, response.statusCode());
        assertEquals("Failed to deserialize JSON request entity", Answer.text(response));
    }

    /** The components the refusal names, in the order Helidon Validation lists them. */
    private static List<String> named(HttpResponse<byte[]> response) {
        Matcher m = COMPONENT.matcher(Answer.json(response).get("error").asText());
        List<String> out = new ArrayList<>();
        while (m.find()) {
            out.add(m.group(1));
        }
        return out;
    }
}
