package unittests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.http.HttpResponse;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.fasterxml.jackson.databind.JsonNode;
import io.javalin.testtools.Response;

/** Readers for an answer, from the testtools client or as bytes. */
final class Answer {

    private static final Pattern SERIAL = Pattern.compile("(\\d+)\\|\\d+");

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

    /** x-rb-serial, after checking it starts with the Unix time in milliseconds it was written at. */
    static String serial(Response response) {
        return checked(header(response, "x-rb-serial"));
    }

    /** x-rb-serial, after checking it starts with the Unix time in milliseconds it was written at. */
    static String serial(HttpResponse<?> response) {
        return checked(header(response, "x-rb-serial"));
    }

    private static String checked(String serial) {
        Matcher form = SERIAL.matcher(String.valueOf(serial));
        assertTrue(form.matches(), "x-rb-serial " + serial + " is not <time stamp>|<count>");
        long age = System.currentTimeMillis() - Long.parseLong(form.group(1));
        assertTrue(age >= 0 && age < 60_000, "x-rb-serial " + serial + " was written " + age + " ms ago");
        return serial;
    }
}
