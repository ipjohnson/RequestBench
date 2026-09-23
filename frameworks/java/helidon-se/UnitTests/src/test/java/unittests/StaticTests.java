package unittests;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.net.http.HttpResponse;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

class StaticTests extends HelidonApp {

    // rb:test static.file
    @Test
    @Tag("static.file")
    void theFileIsSentAsItIsWithItsLengthAndAge() throws Exception {
        HttpResponse<byte[]> response = get("/static/items.large.json");

        byte[] file = Expected.bytes("items.large.json");
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
