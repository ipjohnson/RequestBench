package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.http.HttpResponse;

import tools.jackson.databind.JsonNode;

/** Readers for an answer. */
final class Answer {

    private Answer() {}

    static JsonNode json(HttpResponse<byte[]> response) {
        return Expected.JSON.readTree(response.body());
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
}
