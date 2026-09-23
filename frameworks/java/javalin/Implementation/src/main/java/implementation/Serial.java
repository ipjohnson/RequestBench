package implementation;

import java.util.concurrent.atomic.AtomicLong;

import io.javalin.http.Context;

/**
 * x-rb-serial: one counter for the whole process. A handler that writes it increments it and
 * writes the new value, so an answer the cache replays carries the value it was stored with.
 */
public final class Serial {

    public static final String HEADER = "x-rb-serial";

    private static final AtomicLong LAST = new AtomicLong();

    private Serial() {}

    public static void write(Context ctx) {
        ctx.header(HEADER, Long.toString(LAST.incrementAndGet()));
    }
}
