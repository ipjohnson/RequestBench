package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static unittests.Http.get;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.response.Response;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@QuarkusTest
class BaselineTests {

    // rb:test baseline.plaintext
    @Test
    @Tag("baseline.plaintext")
    void plaintextIsTheStringAsText() {
        Response response = get("/plaintext");

        assertEquals("Hello, World!", response.asString());
        assertTrue(response.contentType().startsWith("text/plain"));
    }
}
