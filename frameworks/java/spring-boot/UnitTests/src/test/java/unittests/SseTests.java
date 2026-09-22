package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

class SseTests extends SpringApp {

    // rb:test sse.medium
    @Test
    @Tag("sse.medium")
    void eachRowIsTheDataOfOneMessageEventWithNoId() throws Exception {
        HttpResponse<byte[]> response = get("/sse/medium", "accept", "text/event-stream");

        assertTrue(Answer.header(response, "content-type").startsWith("text/event-stream"));
        assertNull(Answer.header(response, "content-length"));
        JsonNode rows = Expected.json("items.medium.json").get("items");
        List<Event> events = events(new String(response.body(), StandardCharsets.UTF_8));
        assertEquals(rows.size(), events.size());
        for (int i = 0; i < events.size(); i++) {
            assertEquals("message", events.get(i).type());
            assertEquals("", events.get(i).id());
            assertEquals(rows.get(i), Expected.JSON.readTree(events.get(i).data()));
        }
    }

    record Event(String type, String data, String id) {}

    /** The events an EventSource dispatches, by the HTML standard's rules, as the corpus reads them. */
    private static List<Event> events(String stream) {
        List<Event> out = new ArrayList<>();
        String type = "";
        StringBuilder data = new StringBuilder();
        String id = "";
        String[] lines = stream.split("\r\n|\r|\n", -1);
        // Whatever follows the last line ending is not a whole line.
        for (int n = 0; n < lines.length - 1; n++) {
            String line = lines[n];
            if (line.isEmpty()) {
                if (!data.isEmpty()) {
                    out.add(new Event(type.isEmpty() ? "message" : type, data.substring(0, data.length() - 1), id));
                }
                type = "";
                data.setLength(0);
                continue;
            }
            if (line.startsWith(":")) {
                continue;
            }
            int colon = line.indexOf(':');
            String field = colon < 0 ? line : line.substring(0, colon);
            String value = colon < 0 ? "" : line.substring(colon + 1);
            value = value.startsWith(" ") ? value.substring(1) : value;
            switch (field) {
                case "event" -> type = value;
                case "data" -> data.append(value).append('\n');
                case "id" -> id = value;
                default -> { }
            }
        }
        return out;
    }
}
