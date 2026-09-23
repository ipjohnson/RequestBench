package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.net.URI;
import java.util.List;

import client.openapi.api.BodyRoutesApi;
import client.openapi.api.ItemsRoutesApi;
import client.openapi.api.JsonRoutesApi;
import client.openapi.api.ParametersRoutesApi;
import client.openapi.api.QueryRoutesApi;
import client.openapi.model.BoundOrderRequest;
import client.openapi.model.EchoedOne1;
import client.openapi.model.EchoedTwo;
import client.openapi.model.Item;
import client.openapi.model.Line;
import client.openapi.model.OrderRequest;
import client.openapi.model.Payload;
import io.quarkus.rest.client.reactive.QuarkusRestClientBuilder;
import io.quarkus.test.common.http.TestHTTPResource;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.ws.rs.WebApplicationException;
import org.junit.jupiter.api.Test;

/**
 * The REST Client the Quarkiverse OpenAPI Generator writes from the document in Client/, calling
 * the application @QuarkusTest started. These hold the client to what Quarkus answers, not Quarkus
 * to a corpus row, so they carry no corpus tag.
 */
@QuarkusTest
class ClientTests {

    @TestHTTPResource("/")
    URI root;

    @Test
    void jsonSmallIsTheFirstRow() {
        Payload answer = client(JsonRoutesApi.class).jsonSmallGet();

        assertEquals("small", answer.getSize());
        assertEquals(1, answer.getCount());
        assertEquals(1, answer.getItems().getFirst().getId());
    }

    @Test
    void aRowIsTypedByTheResourceMethodsReturnType() {
        Item row = client(ItemsRoutesApi.class).itemsIdGet(17);

        assertEquals(17, row.getId());
    }

    @Test
    void aValidatedOrderIsBound() {
        BoundOrderRequest answer = client(BodyRoutesApi.class).bodyValidateSmallPost(order(1, "open", 1, 1));

        assertEquals(4, answer.getFields());
        assertEquals(1, answer.getEcho().getCustomerId());
    }

    @Test
    void aRejectedOrderIsAWebApplicationExceptionWithTheStatus() {
        WebApplicationException refused = assertThrows(WebApplicationException.class,
            () -> client(BodyRoutesApi.class).bodyValidateSmallPost(order(0, "", 0, 0)));

        assertEquals(400, refused.getResponse().getStatus());
    }

    @Test
    void queryAndPathParametersAreTyped() {
        EchoedOne1 query = client(QueryRoutesApi.class).queryOneGet(417);
        EchoedTwo path = client(ParametersRoutesApi.class).parametersOneWithSecondTwoGet(4821, 7390);

        assertEquals(417, query.getEcho().getPage());
        assertEquals(List.of(4821, 7390), List.of(path.getEcho().getOne(), path.getEcho().getTwo()));
    }

    private <T> T client(Class<T> api) {
        return QuarkusRestClientBuilder.newBuilder().baseUri(root).build(api);
    }

    /** An order of one line, in the client's own model. */
    private static OrderRequest order(int customerId, String status, int productId, int qty) {
        return new OrderRequest().customerId(customerId).status(status).lines(List.of(new Line().productId(productId).qty(qty)));
    }
}
