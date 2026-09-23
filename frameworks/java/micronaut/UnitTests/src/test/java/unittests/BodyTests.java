package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import io.micronaut.json.tree.JsonNode;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

class BodyTests extends MicronautApp {

    /** A violation's message: the property path from the handler's parameter, a colon and the rule's message. */
    private static final Pattern VIOLATION = Pattern.compile("^order\\.([\\w.\\[\\]]+): ");

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
        assertEquals(200, response.statusCode());
        Answer.is(Expected.object("fields", 2 + 2 * order.get("lines").size(), "bytes", body.length, "echo", order), response);
    }

    // rb:test body.rejected_all
    @Test
    @Tag("body.rejected_all")
    void micronautValidationRefusesOrderInvalidNamingEveryRuleItBreaks() throws Exception {
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

    @ParameterizedTest
    @ValueSource(strings = {"/body/validate/small", "/body/validate/first-error"})
    void aBadLineIsNamedByItsIndex(String path) throws Exception {
        byte[] body = "{\"customerId\":1,\"status\":\"open\",\"lines\":[{\"productId\":1,\"qty\":0}]}".getBytes(StandardCharsets.UTF_8);

        assertEquals(List.of("lines[0].qty"), named(send("POST", path, "application/json", body)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"/body/validate/small", "/body/validate/first-error"})
    void serialisationRefusesAValueOfTheWrongTypeBeforeValidationAndNamesNoField(String path) throws Exception {
        byte[] body = "{\"customerId\":\"not-an-int\",\"status\":42,\"lines\":\"nope\"}".getBytes(StandardCharsets.UTF_8);

        HttpResponse<byte[]> response = send("POST", path, "application/json", body);

        assertEquals(400, response.statusCode());
        assertEquals(List.of(), named(response));
    }

    /** The properties the refusal names, in the order it lists them. */
    private static List<String> named(HttpResponse<byte[]> response) {
        List<String> fields = new ArrayList<>();
        for (JsonNode error : Answer.json(response).get("_embedded").get("errors").values()) {
            Matcher m = VIOLATION.matcher(error.get("message").getStringValue());
            if (m.find()) {
                fields.add(m.group(1));
            }
        }
        return fields;
    }
}
