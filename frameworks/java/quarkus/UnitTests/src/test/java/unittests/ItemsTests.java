package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static unittests.Http.get;
import static unittests.Http.send;

import java.util.Iterator;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.response.Response;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@QuarkusTest
class ItemsTests {

    // rb:test items.read
    @Test
    @Tag("items.read")
    void aRowIsReadByTheIdInThePath() {
        Answer.is(Expected.row(17), get("/items/17"));
    }

    // rb:test items.head
    @Test
    @Tag("items.head")
    void headIsAnsweredByTheGetMethodWithNoBody() {
        Response response = Http.request().head("/items/17");

        assertEquals(200, response.statusCode());
        assertTrue(response.header("content-type").startsWith("application/json"));
        assertEquals(0, response.asByteArray().length);
    }

    // rb:test items.create
    @Test
    @Tag("items.create")
    void aCreatedItemIsTheRowAfterTheLast() {
        Response response = send("POST", "/items", "application/json", Expected.bytes("items.new.json"));

        assertEquals(201, response.statusCode());
        assertTrue(response.header("location").endsWith("/items/1426"), response.header("location"));
        Answer.is(numbered(1426), response);
    }

    // rb:test items.replace
    @Test
    @Tag("items.replace")
    void aReplacedItemTakesTheIdInThePath() {
        Answer.is(numbered(17), send("PUT", "/items/17", "application/json", Expected.bytes("items.new.json")));
    }

    // rb:test items.update
    @Test
    @Tag("items.update")
    void aPatchIsMergedOntoTheRow() {
        Response response = send("PATCH", "/items/17", "application/json", Expected.bytes("items.patch.json"));

        ObjectNode merged = Expected.row(17);
        for (Iterator<Map.Entry<String, JsonNode>> fields = Expected.json("items.patch.json").fields(); fields.hasNext();) {
            Map.Entry<String, JsonNode> field = fields.next();
            merged.set(field.getKey(), field.getValue());
        }
        Answer.is(merged, response);
    }

    // rb:test items.delete
    @Test
    @Tag("items.delete")
    void aDeleteIsAnswered204WithNoBody() {
        Response response = Http.request().delete("/items/17");

        assertEquals(204, response.statusCode());
        assertEquals(0, response.asByteArray().length);
    }

    private static ObjectNode numbered(int id) {
        ObjectNode item = Expected.JSON.createObjectNode().put("id", id);
        item.setAll((ObjectNode) Expected.json("items.new.json"));
        return item;
    }
}
