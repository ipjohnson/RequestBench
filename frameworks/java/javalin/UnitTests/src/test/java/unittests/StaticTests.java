package unittests;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.net.http.HttpResponse;

import io.javalin.testtools.JavalinTest;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

class StaticTests extends JavalinApp {

    // rb:test static.file
    @Test
    @Tag("static.file")
    void theFileIsSentAsItIsWithItsLengthAndAge() {
        JavalinTest.test(app(), (server, client) -> {
            HttpResponse<byte[]> response = send(request(client, "/static/items.large.json").GET());

            byte[] file = Expected.bytes("items.large.json");
            assertArrayEquals(file, response.body());
            assertEquals("application/json", Answer.header(response, "content-type"));
            assertEquals(String.valueOf(file.length), Answer.header(response, "content-length"));
            assertNotNull(Answer.header(response, "last-modified"));
        });
    }
}
