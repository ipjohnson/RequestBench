package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.Map;

import client.ApiClient;
import client.ApiException;
import client.api.DefaultApi;
import client.model.Bound;
import client.model.Echoed;
import client.model.Item;
import client.model.Line;
import client.model.OrderRequest;
import client.model.Payload;
import io.javalin.testtools.HttpClient;
import io.javalin.testtools.JavalinTest;
import org.junit.jupiter.api.Test;

/**
 * The client in Client/, which OpenAPI Generator writes from the document the @OpenApi annotations
 * describe, calling the Implementation JavalinTest started. These hold the client to what Javalin
 * answers, not Javalin to a corpus row, so they carry no corpus tag.
 */
class ClientTests extends JavalinApp {

    @Test
    void jsonSmallIsTheFirstRow() {
        JavalinTest.test(app(), (server, client) -> {
            Payload answer = api(client).jsonSmallGet();

            assertEquals("small", answer.getSize());
            assertEquals(1, answer.getCount());
            assertEquals(1, answer.getItems().getFirst().getId());
        });
    }

    @Test
    void aRowIsTypedByTheResponseTheAnnotationNames() {
        JavalinTest.test(app(), (server, client) -> {
            Item row = api(client).itemsIdGet(17);

            assertEquals(17, row.getId());
        });
    }

    @Test
    void aValidatedOrderIsBound() {
        JavalinTest.test(app(), (server, client) -> {
            Bound answer = api(client).bodyValidateSmallPost(order(1, "open", 1, 1));

            assertEquals(4, answer.getFields());
            assertEquals(1, answer.getEcho().getCustomerId());
        });
    }

    @Test
    void aRejectedOrderIsAnApiExceptionWithTheStatus() {
        JavalinTest.test(app(), (server, client) -> {
            ApiException refused = assertThrows(ApiException.class, () -> api(client).bodyValidateSmallPost(order(0, "", 0, 0)));

            assertEquals(400, refused.getCode());
        });
    }

    /** The echo is a type parameter of Echoed, which the document names as an object, so the client reads it as a map. */
    @Test
    void queryAndPathParametersAreTyped() {
        JavalinTest.test(app(), (server, client) -> {
            Echoed query = api(client).queryOneGet(417);
            Echoed path = api(client).parametersOneWithSecondTwoGet(4821, 7390);

            assertEquals(Map.of("page", 417.0), query.getEcho());
            assertEquals(Map.of("one", 4821.0, "two", 7390.0), path.getEcho());
        });
    }

    private static DefaultApi api(HttpClient client) {
        ApiClient api = new ApiClient();
        api.setBasePath(client.getOrigin());
        return new DefaultApi(api);
    }

    /** An order of one line, in the client's own model. */
    private static OrderRequest order(int customerId, String status, int productId, int qty) {
        return new OrderRequest().customerId(customerId).status(status).lines(List.of(new Line().productId(productId).qty(qty)));
    }
}
