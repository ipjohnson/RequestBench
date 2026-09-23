package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;

import com.fasterxml.jackson.databind.JsonNode;

/** Readers for an answer. */
final class Answer {

    private Answer() {}

    static JsonNode json(HttpResponse<byte[]> response) {
        try {
            return Expected.JSON.readTree(response.body());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    static void is(JsonNode expected, HttpResponse<byte[]> response) {
        assertEquals(expected, json(response));
    }

    static String header(HttpResponse<byte[]> response, String name) {
        return response.headers().firstValue(name).orElse(null);
    }

    static long serial(HttpResponse<byte[]> response) {
        return Long.parseLong(header(response, "x-rb-serial"));
    }

    static String text(HttpResponse<byte[]> response) {
        return new String(response.body(), StandardCharsets.UTF_8);
    }
}
