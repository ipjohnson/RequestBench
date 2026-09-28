package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.http.HttpResponse;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import tools.jackson.databind.JsonNode;

/** Readers for an answer. */
final class Answer {

    private static final Pattern SERIAL = Pattern.compile("(\\d+)\\|\\d+");

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
