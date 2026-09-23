package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.http.HttpResponse;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

class BaselineTests extends VertxApp {

    // rb:test baseline.plaintext
    @Test
    @Tag("baseline.plaintext")
    void plaintextIsTheStringAsText() throws Exception {
        HttpResponse<byte[]> response = get("/plaintext");

        assertEquals("Hello, World!", Answer.text(response));
        assertTrue(Answer.header(response, "content-type").startsWith("text/plain"));
    }
}
