package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayInputStream;
import java.net.http.HttpResponse;
import java.util.zip.GZIPInputStream;

import io.javalin.testtools.HttpClient;
import io.javalin.testtools.JavalinTest;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class CompressedTests extends JavalinApp {

    // rb:test compressed.gzip_large
    @Test
    @Tag("compressed.gzip_large")
    void gzipAskedForIsGzipAnsweredAndTheHandlerRunsEachTime() {
        JavalinTest.test(app(), (server, client) -> {
            HttpResponse<byte[]> first = ask(client, "/compressed/large", "gzip");
            HttpResponse<byte[]> second = ask(client, "/compressed/large", "gzip");

            assertEquals("gzip", Answer.header(second, "content-encoding"));
            try (GZIPInputStream unzipped = new GZIPInputStream(new ByteArrayInputStream(second.body()))) {
                assertEquals(Expected.json("items.large.json"), Expected.JSON.readTree(unzipped));
            }
            assertTrue(Answer.serial(second) > Answer.serial(first));
        });
    }

    // rb:test compressed.gzip_small
    @Test
    @Tag("compressed.gzip_small")
    void aBodyUnder1500BytesIsWrittenAsItIs() {
        JavalinTest.test(app(), (server, client) -> {
            HttpResponse<byte[]> response = ask(client, "/compressed/small", "gzip");

            assertNull(Answer.header(response, "content-encoding"));
            assertEquals(Expected.json("items.small.json"), Expected.JSON.readTree(response.body()));
        });
    }

    // rb:test compressed.identity_small,compressed.identity_large
    @ParameterizedTest
    @Tag("compressed.identity_small")
    @Tag("compressed.identity_large")
    @ValueSource(strings = {"small", "large"})
    void identityAskedForIsAnsweredAsWritten(String size) {
        JavalinTest.test(app(), (server, client) -> {
            HttpResponse<byte[]> response = ask(client, "/compressed/" + size, "identity");

            assertNull(Answer.header(response, "content-encoding"));
            assertEquals(Expected.json("items." + size + ".json"), Expected.JSON.readTree(response.body()));
        });
    }

    private static HttpResponse<byte[]> ask(HttpClient client, String path, String encoding) throws Exception {
        return send(request(client, path, "accept-encoding", encoding, "cache-control", "no-cache").GET());
    }
}
