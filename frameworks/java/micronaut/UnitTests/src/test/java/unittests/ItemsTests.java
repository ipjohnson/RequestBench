package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import io.micronaut.json.tree.JsonNode;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

class ItemsTests extends MicronautApp {

    // rb:test items.read
    @Test
    @Tag("items.read")
    void aRowIsReadByTheIdInThePath() throws Exception {
        Answer.is(Expected.row(17), get("/items/17"));
    }

    // rb:test items.head
    @Test
    @Tag("items.head")
    void headIsAnsweredByTheGetRouteWithNoBody() throws Exception {
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

        Answer.is(Expected.with(Expected.row(17), Expected.json("items.patch.json")), response);
    }

    // rb:test items.delete
    @Test
    @Tag("items.delete")
    void aDeleteIsAnswered204WithNoBody() throws Exception {
        HttpResponse<byte[]> response = send(request("/items/17").DELETE());

        assertEquals(204, response.statusCode());
        assertEquals(0, response.body().length);
    }

    private static JsonNode numbered(int id) {
        return Expected.with(Expected.object("id", id), Expected.json("items.new.json"));
    }
}
