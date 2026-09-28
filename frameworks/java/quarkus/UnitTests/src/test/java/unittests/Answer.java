package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.fasterxml.jackson.databind.JsonNode;
import io.restassured.response.Response;

/** Readers for an answer. */
final class Answer {

    private static final Pattern SERIAL = Pattern.compile("(\\d+)\\|\\d+");

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

    /** x-rb-serial, after checking it starts with the Unix time in milliseconds it was written at. */
    static String serial(Response response) {
        String serial = response.header("x-rb-serial");
        Matcher form = SERIAL.matcher(String.valueOf(serial));
        assertTrue(form.matches(), "x-rb-serial " + serial + " is not <time stamp>|<count>");
        long age = System.currentTimeMillis() - Long.parseLong(form.group(1));
        assertTrue(age >= 0 && age < 60_000, "x-rb-serial " + serial + " was written " + age + " ms ago");
        return serial;
    }
}
