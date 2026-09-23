package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.IOException;
import java.io.UncheckedIOException;

import com.fasterxml.jackson.databind.JsonNode;
import io.restassured.response.Response;

/** Readers for an answer. */
final class Answer {

    private Answer() {}

    static JsonNode json(Response response) {
        try {
            return Expected.JSON.readTree(response.asByteArray());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    static void is(JsonNode expected, Response response) {
        assertEquals(expected, json(response));
    }

    static long serial(Response response) {
        return Long.parseLong(response.header("x-rb-serial"));
    }
}
