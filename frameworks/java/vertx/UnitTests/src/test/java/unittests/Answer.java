package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;

import io.vertx.core.buffer.Buffer;
import io.vertx.core.json.JsonObject;

/** Readers for an answer. */
final class Answer {

    private Answer() {}

    static JsonObject json(HttpResponse<byte[]> response) {
        return Buffer.buffer(response.body()).toJsonObject();
    }

    static String text(HttpResponse<byte[]> response) {
        return new String(response.body(), StandardCharsets.UTF_8);
    }

    static void is(JsonObject expected, HttpResponse<byte[]> response) {
        assertEquals(expected, json(response));
    }

    static String header(HttpResponse<byte[]> response, String name) {
        return response.headers().firstValue(name).orElse(null);
    }

    static long serial(HttpResponse<byte[]> response) {
        return Long.parseLong(header(response, "x-rb-serial"));
    }
}
