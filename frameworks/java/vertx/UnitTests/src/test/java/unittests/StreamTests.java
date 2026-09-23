package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.http.HttpResponse;

import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

class StreamTests extends VertxApp {

    // rb:test stream.ndjson
    @Test
    @Tag("stream.ndjson")
    void eachRowIsALineAndTheLengthIsNeverSent() throws Exception {
        HttpResponse<byte[]> response = get("/stream/items");

        assertTrue(Answer.header(response, "content-type").startsWith("application/x-ndjson"));
        assertNull(Answer.header(response, "content-length"));
        String[] lines = Answer.text(response).stripTrailing().split("\n");
        JsonArray rows = Expected.json("items.medium.json").getJsonArray("items");
        assertEquals(rows.size(), lines.length);
        for (int i = 0; i < lines.length; i++) {
            assertEquals(rows.getJsonObject(i), new JsonObject(lines[i]));
        }
    }
}
