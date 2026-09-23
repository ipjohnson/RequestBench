package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

class BaselineTests extends MicronautApp {

    // rb:test baseline.plaintext
    @Test
    @Tag("baseline.plaintext")
    void plaintextIsTheStringAsText() throws Exception {
        HttpResponse<byte[]> response = get("/plaintext");

        assertEquals("Hello, World!", new String(response.body(), StandardCharsets.UTF_8));
        assertTrue(Answer.header(response, "content-type").startsWith("text/plain"));
    }
}
