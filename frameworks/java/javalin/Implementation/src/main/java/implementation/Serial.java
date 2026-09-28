package implementation;

import java.util.concurrent.atomic.AtomicLong;

import io.javalin.http.Context;

/**
 * x-rb-serial: the Unix time in milliseconds, a bar, and one counter for the whole process. A
 * handler that writes it increments the counter and writes both, so an answer the cache replays
 * carries the value it was stored with.
 */
public final class Serial {

    public static final String HEADER = "x-rb-serial";

    private static final AtomicLong LAST = new AtomicLong();

    private Serial() {}

    public static void write(Context ctx) {
        ctx.header(HEADER, System.currentTimeMillis() + "|" + LAST.incrementAndGet());
    }
}
