package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.javalin.testtools.JavalinTest;
import io.javalin.testtools.Response;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

class ItemsTests extends JavalinApp {

    // rb:test items.read
    @Test
    @Tag("items.read")
    void aRowIsReadByTheIdInThePath() {
        JavalinTest.test(app(), (server, client) -> Answer.is(Expected.row(17), client.get("/items/17")));
    }

    // rb:test items.head
    @Test
    @Tag("items.head")
    void headRunsTheGetHandlerAndSendsNoBody() {
        JavalinTest.test(app(), (server, client) -> {
            HttpResponse<byte[]> response = send(request(client, "/items/17").method("HEAD", HttpRequest.BodyPublishers.noBody()));

            assertEquals(200, response.statusCode());
            assertTrue(Answer.header(response, "content-type").startsWith("application/json"));
            assertEquals(0, response.body().length);
        });
    }

    // rb:test items.create
    @Test
    @Tag("items.create")
    void aCreatedItemIsTheRowAfterTheLast() {
        JavalinTest.test(app(), (server, client) -> {
            Response response = client.post("/items", Expected.text("items.new.json"));

            assertEquals(201, response.code());
            assertEquals("/items/1426", Answer.header(response, "location"));
            Answer.is(numbered(1426), response);
        });
    }

    // rb:test items.replace
    @Test
    @Tag("items.replace")
    void aReplacedItemTakesTheIdInThePath() {
        JavalinTest.test(app(), (server, client) -> Answer.is(numbered(17), client.put("/items/17", Expected.text("items.new.json"))));
    }

    // rb:test items.update
    @Test
    @Tag("items.update")
    void aPatchIsMergedOntoTheRow() {
        ObjectNode merged = Expected.row(17);
        for (Map.Entry<String, JsonNode> field : Expected.json("items.patch.json").properties()) {
            merged.set(field.getKey(), field.getValue());
        }

        JavalinTest.test(app(), (server, client) -> Answer.is(merged, client.patch("/items/17", Expected.text("items.patch.json"))));
    }

    // rb:test items.delete
    @Test
    @Tag("items.delete")
    void aDeleteIsAnswered204WithNoBody() {
        JavalinTest.test(app(), (server, client) -> {
            Response response = client.delete("/items/17");

            assertEquals(204, response.code());
            assertEquals("", response.body().string());
        });
    }

    private static ObjectNode numbered(int id) {
        ObjectNode item = Expected.JSON.createObjectNode().put("id", id);
        item.setAll((ObjectNode) Expected.json("items.new.json"));
        return item;
    }
}
