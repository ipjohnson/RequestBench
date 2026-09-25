package implementation

import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.header
import java.util.concurrent.atomic.AtomicLong

// x-rb-serial: one counter for the process, shared by every thread Netty and Ktor run calls on. A
// handler that writes it takes the next value, so an answer the cache family replays carries the
// value it was stored with.
private val serials = AtomicLong()

/** Writes x-rb-serial, to show the handler ran for this answer. */
fun ApplicationCall.fresh() {
    response.header("x-rb-serial", serials.incrementAndGet())
}
