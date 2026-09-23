package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import client.api.DefaultApi;
import client.model.BodyRoutesBoundOrderRequest;
import client.model.EchoedParametersRoutesTwo;
import client.model.EchoedQueryRoutesOne;
import client.model.Item;
import client.model.OrderRequest;
import client.model.OrderRequestLine;
import client.model.Payload;
import io.micronaut.http.client.exceptions.HttpClientResponseException;
import jakarta.inject.Inject;
import jakarta.validation.ConstraintViolationException;
import org.junit.jupiter.api.Test;

/**
 * The declarative client in Client/, generated from the document micronaut-openapi writes, calling
 * the Implementation on its random port. These hold the client to what Micronaut answers, not
 * Micronaut to a corpus row, so they carry no corpus tag. Each method is named after the handler
 * that answers it, with a number where two handlers share a name.
 */
class ClientTests extends MicronautApp {

    @Inject
    DefaultApi client;

    /** The client's base path, which a relative URL resolves against the embedded server. */
    @Override
    public Map<String, String> getProperties() {
        Map<String, String> properties = new HashMap<>(super.getProperties());
        properties.put("openapi-micronaut-client.base-path", "/");
        return properties;
    }

    @Test
    void jsonSmallIsTheFirstRow() {
        Payload answer = client.small5().block();

        assertEquals("small", answer.getSize());
        assertEquals(1, answer.getCount());
        assertEquals(1, answer.getItems().getFirst().getId());
    }

    @Test
    void aRowIsTypedByTheHandlersReturnType() {
        Item row = client.read(17).block();

        assertEquals(17, row.getId());
    }

    /** The document describes the echo as an object with no properties, so the model holds it as a map. */
    @Test
    void aValidatedOrderIsBound() {
        BodyRoutesBoundOrderRequest answer = client.validateSmall(order(1, "open", 1, 1)).block();

        assertEquals(4, answer.getFields());
        assertEquals(1, ((Map<?, ?>) answer.getEcho()).get("customerId"));
    }

    /** The generated model carries the document's rules, and the client checks them before it sends. */
    @Test
    void anOrderTheModelRefusesIsNeverSent() {
        assertThrows(ConstraintViolationException.class, () -> client.validateSmall(order(1, "", 1, 1)));
    }

    /**
     * The document gives customerId an exclusive minimum of 0, which the generated model checks as
     * @Min(0), so the client sends 0 and the Implementation refuses it.
     */
    @Test
    void anOrderTheImplementationRefusesIsAnHttpClientResponseExceptionWithTheStatus() {
        HttpClientResponseException refused = assertThrows(HttpClientResponseException.class, () -> client.validateSmall(order(0, "open", 1, 1)).block());

        assertEquals(400, refused.getStatus().getCode());
    }

    @Test
    void queryAndPathParametersAreTyped() {
        EchoedQueryRoutesOne query = client.one1(417).block();
        EchoedParametersRoutesTwo path = client.two(4821, 7390).block();

        assertEquals(417, query.getEcho().getPage());
        assertEquals(List.of(4821, 7390), List.of(path.getEcho().getOne(), path.getEcho().getTwo()));
    }

    /** An order of one line, in the client's own model. */
    private static OrderRequest order(int customerId, String status, int productId, int qty) {
        return new OrderRequest(customerId, status, List.of(new OrderRequestLine(productId, qty)));
    }
}
