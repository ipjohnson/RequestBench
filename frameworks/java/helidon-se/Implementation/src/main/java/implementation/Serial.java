package implementation;

import java.util.concurrent.atomic.AtomicLong;

import io.helidon.http.HeaderName;
import io.helidon.http.HeaderNames;
import io.helidon.webserver.http.ServerResponse;

/**
 * x-rb-serial: one counter for the whole process. A handler that writes it increments it and
 * writes the new value, so an answer the cache replays carries the value it was stored with.
 */
public final class Serial {

    public static final HeaderName HEADER = HeaderNames.create("x-rb-serial");

    private static final AtomicLong LAST = new AtomicLong();

    private Serial() {}

    public static String next() {
        return Long.toString(LAST.incrementAndGet());
    }

    public static void write(ServerResponse response) {
        response.header(HEADER, next());
    }
}
