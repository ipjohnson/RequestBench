package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.javalin.testtools.JavalinTest;
import io.javalin.testtools.Response;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

class BaselineTests extends JavalinApp {

    // rb:test baseline.plaintext
    @Test
    @Tag("baseline.plaintext")
    void plaintextIsTheStringAsText() {
        JavalinTest.test(app(), (server, client) -> {
            Response response = client.get("/plaintext");

            assertEquals("Hello, World!", response.body().string());
            assertTrue(Answer.header(response, "content-type").startsWith("text/plain"));
        });
    }
}
