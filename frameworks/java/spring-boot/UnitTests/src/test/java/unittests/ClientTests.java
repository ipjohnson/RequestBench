package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;

import client.kiota.SpringBootClient;
import client.kiota.models.BoundOrderRequest;
import client.kiota.models.EchoedOne;
import client.kiota.models.EchoedTwo;
import client.kiota.models.Item;
import client.kiota.models.Line;
import client.kiota.models.OrderRequest;
import client.kiota.models.Payload;
import com.microsoft.kiota.ApiException;
import com.microsoft.kiota.authentication.AnonymousAuthenticationProvider;
import com.microsoft.kiota.bundle.DefaultRequestAdapter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.web.server.LocalServerPort;

/**
 * The Kiota client in Client/, generated from the document springdoc serves, calling the
 * Implementation on its random port. These hold the client to what Spring Boot answers, not Spring
 * Boot to a corpus row, so they carry no corpus tag.
 */
class ClientTests extends SpringApp {

    @LocalServerPort
    private int port;

    private SpringBootClient client;

    @BeforeEach
    void connect() {
        // The client registers no serializers. The bundle's adapter registers Microsoft's.
        DefaultRequestAdapter adapter = new DefaultRequestAdapter(new AnonymousAuthenticationProvider());
        adapter.setBaseUrl("http://127.0.0.1:" + port);
        client = new SpringBootClient(adapter);
    }

    @Test
    void jsonSmallIsTheFirstRow() {
        Payload answer = client.json().small().get();

        assertEquals("small", answer.getSize());
        assertEquals(1, answer.getCount());
        assertEquals(1, answer.getItems().getFirst().getId());
    }

    @Test
    void aRowIsTypedByTheControllersReturnType() {
        Item row = client.items().byId(17).get();

        assertEquals(17, row.getId());
    }

    @Test
    void aValidatedOrderIsBound() {
        BoundOrderRequest answer = client.body().validate().small().post(order(1, "open", 1, 1));

        assertEquals(4, answer.getFields());
        assertEquals(1, answer.getEcho().getCustomerId());
    }

    @Test
    void aRejectedOrderIsAnApiExceptionWithTheStatus() {
        ApiException refused = assertThrows(ApiException.class, () -> client.body().validate().small().post(order(0, "", 0, 0)));

        assertEquals(400, refused.getResponseStatusCode());
    }

    @Test
    void queryAndPathParametersAreTyped() {
        EchoedOne query = client.query().one().get(config -> config.queryParameters.page = 417);
        EchoedTwo path = client.parameters().byOne(4821).withSecond().byTwo(7390).get();

        assertEquals(417, query.getEcho().getPage());
        assertEquals(List.of(4821, 7390), List.of(path.getEcho().getOne(), path.getEcho().getTwo()));
    }

    /** An order of one line, in the client's own model. */
    private static OrderRequest order(int customerId, String status, int productId, int qty) {
        Line line = new Line();
        line.setProductId(productId);
        line.setQty(qty);
        OrderRequest order = new OrderRequest();
        order.setCustomerId(customerId);
        order.setStatus(status);
        order.setLines(List.of(line));
        return order;
    }
}
