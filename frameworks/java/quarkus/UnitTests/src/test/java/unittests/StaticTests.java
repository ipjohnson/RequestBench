package unittests;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static unittests.Http.get;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.response.Response;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@QuarkusTest
class StaticTests {

    // rb:test static.file
    @Test
    @Tag("static.file")
    void theFileIsSentAsItIsWithItsLengthAndAge() {
        Response response = get("/static/items.large.json");

        byte[] file = Expected.bytes("items.large.json");
        assertArrayEquals(file, response.asByteArray());
        assertEquals("application/json", response.contentType());
        assertEquals(String.valueOf(file.length), response.header("content-length"));
        assertNotNull(response.header("last-modified"));
    }

    @Test
    void aFileThatIsNotThereIsA404() {
        assertEquals(404, get("/static/nothing.json").statusCode());
    }
}
