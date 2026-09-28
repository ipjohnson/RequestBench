package unittests;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.net.http.HttpResponse;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class StaticTests extends HelidonApp {

    // rb:test static.small,static.medium,static.large
    @ParameterizedTest
    @Tag("static.small")
    @Tag("static.medium")
    @Tag("static.large")
    @ValueSource(strings = {"items.small.json", "items.medium.json", "items.large.json"})
    void theFileIsSentAsItIsWithItsLengthAndAge(String name) throws Exception {
        HttpResponse<byte[]> response = get("/static/" + name);

        byte[] file = Expected.bytes(name);
        assertArrayEquals(file, response.body());
        assertEquals("application/json", Answer.header(response, "content-type"));
        assertEquals(String.valueOf(file.length), Answer.header(response, "content-length"));
        assertNotNull(Answer.header(response, "last-modified"));
    }

    @Test
    void theFeatureRevalidatesTheFileByItsModificationTime() throws Exception {
        String tag = Answer.header(get("/static/items.large.json"), "etag");

        assertEquals(304, get("/static/items.large.json", "if-none-match", tag).statusCode());
    }
}
