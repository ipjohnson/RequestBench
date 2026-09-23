package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;

import io.micronaut.json.tree.JsonNode;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

class StreamTests extends MicronautApp {

    // rb:test stream.ndjson
    @Test
    @Tag("stream.ndjson")
    void eachRowIsALineAndTheLengthIsNeverSent() throws Exception {
        HttpResponse<byte[]> response = get("/stream/items");

        assertTrue(Answer.header(response, "content-type").startsWith("application/x-ndjson"));
        assertNull(Answer.header(response, "content-length"));
        String[] lines = new String(response.body(), StandardCharsets.UTF_8).stripTrailing().split("\n");
        JsonNode rows = Expected.json("items.medium.json").get("items");
        assertEquals(rows.size(), lines.length);
        for (int i = 0; i < lines.length; i++) {
            assertEquals(rows.get(i), Expected.parse(lines[i].getBytes(StandardCharsets.UTF_8)));
        }
    }
}
