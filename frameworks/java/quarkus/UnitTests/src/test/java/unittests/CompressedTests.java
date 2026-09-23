package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static unittests.Http.get;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.zip.GZIPInputStream;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.response.Response;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

@QuarkusTest
class CompressedTests {

    // Vert.x compresses at any size, so the small answer is gzipped as the large one is.
    // rb:test compressed.gzip_small,compressed.gzip_large
    @ParameterizedTest
    @Tag("compressed.gzip_small")
    @Tag("compressed.gzip_large")
    @ValueSource(strings = {"small", "large"})
    void gzipAskedForIsGzipAnsweredAndTheHandlerRunsEachTime(String size) throws IOException {
        Response first = ask("/compressed/" + size, "gzip");
        Response second = ask("/compressed/" + size, "gzip");

        assertEquals("gzip", second.header("content-encoding"));
        try (GZIPInputStream unzipped = new GZIPInputStream(new ByteArrayInputStream(second.asByteArray()))) {
            assertEquals(Expected.json("items." + size + ".json"), Expected.JSON.readTree(unzipped));
        }
        assertTrue(Answer.serial(second) > Answer.serial(first));
    }

    // rb:test compressed.identity_small,compressed.identity_large
    @ParameterizedTest
    @Tag("compressed.identity_small")
    @Tag("compressed.identity_large")
    @ValueSource(strings = {"small", "large"})
    void identityAskedForIsAnsweredAsWritten(String size) {
        Response response = ask("/compressed/" + size, "identity");

        assertNull(response.header("content-encoding"));
        Answer.is(Expected.json("items." + size + ".json"), response);
    }

    private static Response ask(String path, String encoding) {
        return get(path, "accept-encoding", encoding, "cache-control", "no-cache");
    }
}
