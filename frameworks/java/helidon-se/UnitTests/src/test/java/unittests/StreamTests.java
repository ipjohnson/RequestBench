package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.http.HttpResponse;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

class StreamTests extends HelidonApp {

    // rb:test stream.ndjson
    @Test
    @Tag("stream.ndjson")
    void eachRowIsALineAndTheLengthIsNeverSent() throws Exception {
        HttpResponse<byte[]> response = get("/stream/items");

        assertTrue(Answer.header(response, "content-type").startsWith("application/x-ndjson"));
        assertNull(Answer.header(response, "content-length"));
        String[] lines = Answer.text(response).stripTrailing().split("\n");
        JsonNode rows = Expected.json("items.medium.json").get("items");
        assertEquals(rows.size(), lines.length);
        for (int i = 0; i < lines.length; i++) {
            assertEquals(rows.get(i), Expected.JSON.readTree(lines[i]));
        }
    }
}
