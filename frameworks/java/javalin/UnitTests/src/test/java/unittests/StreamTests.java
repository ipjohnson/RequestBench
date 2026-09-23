package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import io.javalin.testtools.JavalinTest;
import io.javalin.testtools.Response;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

class StreamTests extends JavalinApp {

    // rb:test stream.ndjson
    @Test
    @Tag("stream.ndjson")
    void eachRowIsALineAndTheLengthIsNeverSent() {
        JavalinTest.test(app(), (server, client) -> {
            Response response = client.get("/stream/items");

            assertTrue(Answer.header(response, "content-type").startsWith("application/x-ndjson"));
            assertNull(Answer.header(response, "content-length"));
            String[] lines = response.body().string().stripTrailing().split("\n");
            JsonNode rows = Expected.json("items.medium.json").get("items");
            assertEquals(rows.size(), lines.length);
            for (int i = 0; i < lines.length; i++) {
                assertEquals(rows.get(i), Expected.JSON.readTree(lines[i]));
            }
        });
    }
}
