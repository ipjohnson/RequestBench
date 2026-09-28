package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import io.vertx.core.buffer.Buffer;
import io.vertx.core.json.JsonObject;

/** Readers for an answer. */
final class Answer {

    private static final Pattern SERIAL = Pattern.compile("(\\d+)\\|\\d+");

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

    /** x-rb-serial, after checking it starts with the Unix time in milliseconds it was written at. */
    static String serial(HttpResponse<byte[]> response) {
        String serial = header(response, "x-rb-serial");
        Matcher form = SERIAL.matcher(String.valueOf(serial));
        assertTrue(form.matches(), "x-rb-serial " + serial + " is not <time stamp>|<count>");
        long age = System.currentTimeMillis() - Long.parseLong(form.group(1));
        assertTrue(age >= 0 && age < 60_000, "x-rb-serial " + serial + " was written " + age + " ms ago");
        return serial;
    }
}
