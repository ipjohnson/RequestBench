package implementation

import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.header
import java.util.concurrent.atomic.AtomicLong

// x-rb-serial: the Unix time in milliseconds, a bar, and one counter for the process, shared by every
// thread Netty and Ktor run calls on. A handler that writes it takes the next count, so an answer the
// cache family replays carries the value it was stored with.
private val serials = AtomicLong()

/** Writes x-rb-serial, to show the handler ran for this answer. */
fun ApplicationCall.fresh() {
    response.header("x-rb-serial", "${System.currentTimeMillis()}|${serials.incrementAndGet()}")
}
