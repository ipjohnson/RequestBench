package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static unittests.Http.get;

import java.io.IOException;

import com.fasterxml.jackson.databind.JsonNode;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.response.Response;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@QuarkusTest
class StreamTests {

    // rb:test stream.ndjson
    @Test
    @Tag("stream.ndjson")
    void eachRowIsALineAndTheLengthIsNeverSent() throws IOException {
        Response response = get("/stream/items");

        assertTrue(response.contentType().startsWith("application/x-ndjson"));
        assertNull(response.header("content-length"));
        String[] lines = response.asString().stripTrailing().split("\n");
        JsonNode rows = Expected.json("items.medium.json").get("items");
        assertEquals(rows.size(), lines.length);
        for (int i = 0; i < lines.length; i++) {
            assertEquals(rows.get(i), Expected.JSON.readTree(lines[i]));
        }
    }
}
