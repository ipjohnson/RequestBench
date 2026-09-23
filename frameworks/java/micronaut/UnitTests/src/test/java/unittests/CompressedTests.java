package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayInputStream;
import java.net.http.HttpResponse;
import java.util.zip.GZIPInputStream;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class CompressedTests extends MicronautApp {

    // rb:test compressed.gzip_large
    @Test
    @Tag("compressed.gzip_large")
    void gzipAskedForIsGzipAnsweredAndTheHandlerRunsEachTime() throws Exception {
        HttpResponse<byte[]> first = ask("/compressed/large", "gzip");
        HttpResponse<byte[]> second = ask("/compressed/large", "gzip");

        assertEquals("gzip", Answer.header(second, "content-encoding"));
        try (GZIPInputStream unzipped = new GZIPInputStream(new ByteArrayInputStream(second.body()))) {
            assertEquals(Expected.json("items.large.json"), Expected.parse(unzipped.readAllBytes()));
        }
        assertTrue(Answer.serial(second) > Answer.serial(first));
    }

    // rb:test compressed.gzip_small
    @Test
    @Tag("compressed.gzip_small")
    void aBodyUnderTheThresholdIsWrittenAsItIs() throws Exception {
        HttpResponse<byte[]> response = ask("/compressed/small", "gzip");

        assertNull(Answer.header(response, "content-encoding"));
        Answer.is(Expected.json("items.small.json"), response);
    }

    // rb:test compressed.identity_small,compressed.identity_large
    @ParameterizedTest
    @Tag("compressed.identity_small")
    @Tag("compressed.identity_large")
    @ValueSource(strings = {"small", "large"})
    void identityAskedForIsAnsweredAsWritten(String size) throws Exception {
        HttpResponse<byte[]> response = ask("/compressed/" + size, "identity");

        assertNull(Answer.header(response, "content-encoding"));
        Answer.is(Expected.json("items." + size + ".json"), response);
    }

    private HttpResponse<byte[]> ask(String path, String encoding) throws Exception {
        return get(path, "accept-encoding", encoding, "cache-control", "no-cache");
    }
}
