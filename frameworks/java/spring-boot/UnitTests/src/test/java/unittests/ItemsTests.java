package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

class ItemsTests extends SpringApp {

    // rb:test items.read
    @Test
    @Tag("items.read")
    void aRowIsReadByTheIdInThePath() throws Exception {
        Answer.is(Expected.row(17), get("/items/17"));
    }

    // rb:test items.head
    @Test
    @Tag("items.head")
    void headIsAnsweredByTheGetHandlerWithNoBody() throws Exception {
        HttpResponse<byte[]> response = send(request("/items/17").method("HEAD", HttpRequest.BodyPublishers.noBody()));

        assertEquals(200, response.statusCode());
        assertTrue(Answer.header(response, "content-type").startsWith("application/json"));
        assertEquals(0, response.body().length);
    }

    // rb:test items.create
    @Test
    @Tag("items.create")
    void aCreatedItemIsTheRowAfterTheLast() throws Exception {
        HttpResponse<byte[]> response = send("POST", "/items", "application/json", Expected.bytes("items.new.json"));

        assertEquals(201, response.statusCode());
        assertEquals("/items/1426", Answer.header(response, "location"));
        Answer.is(numbered(1426), response);
    }

    // rb:test items.replace
    @Test
    @Tag("items.replace")
    void aReplacedItemTakesTheIdInThePath() throws Exception {
        Answer.is(numbered(17), send("PUT", "/items/17", "application/json", Expected.bytes("items.new.json")));
    }

    // rb:test items.update
    @Test
    @Tag("items.update")
    void aPatchIsMergedOntoTheRow() throws Exception {
        HttpResponse<byte[]> response = send("PATCH", "/items/17", "application/json", Expected.bytes("items.patch.json"));

        ObjectNode merged = Expected.row(17);
        for (Map.Entry<String, JsonNode> field : Expected.json("items.patch.json").properties()) {
            merged.set(field.getKey(), field.getValue());
        }
        Answer.is(merged, response);
    }

    // rb:test items.delete
    @Test
    @Tag("items.delete")
    void aDeleteIsAnswered204WithNoBody() throws Exception {
        HttpResponse<byte[]> response = send(request("/items/17").DELETE());

        assertEquals(204, response.statusCode());
        assertEquals(0, response.body().length);
    }

    private static ObjectNode numbered(int id) {
        ObjectNode item = Expected.JSON.createObjectNode().put("id", id);
        item.setAll((ObjectNode) Expected.json("items.new.json"));
        return item;
    }
}
