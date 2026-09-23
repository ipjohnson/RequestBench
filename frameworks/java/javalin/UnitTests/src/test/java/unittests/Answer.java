package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.net.http.HttpResponse;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import io.javalin.testtools.Response;

/** Readers for an answer, from the testtools client or as bytes. */
final class Answer {

    private Answer() {}

    static JsonNode json(Response response) throws Exception {
        return Expected.JSON.readTree(response.body().string());
    }

    static void is(JsonNode expected, Response response) throws Exception {
        assertEquals(expected, json(response));
    }

    static String header(Response response, String name) {
        List<String> values = response.headers().get(name);
        return values == null ? null : values.getFirst();
    }

    static String header(HttpResponse<?> response, String name) {
        return response.headers().firstValue(name).orElse(null);
    }

    static long serial(Response response) {
        return Long.parseLong(header(response, "x-rb-serial"));
    }

    static long serial(HttpResponse<?> response) {
        return Long.parseLong(header(response, "x-rb-serial"));
    }
}
