package unittests;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static unittests.Http.get;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.response.Response;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

@QuarkusTest
class StaticTests {

    // rb:test static.small,static.medium,static.large
    @ParameterizedTest
    @Tag("static.small")
    @Tag("static.medium")
    @Tag("static.large")
    @ValueSource(strings = {"items.small.json", "items.medium.json", "items.large.json"})
    void theFileIsSentAsItIsWithItsLengthAndAge(String name) {
        Response response = get("/static/" + name);

        byte[] file = Expected.bytes(name);
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
