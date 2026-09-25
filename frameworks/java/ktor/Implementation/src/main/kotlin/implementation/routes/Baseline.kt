package implementation.routes

import io.ktor.server.response.respondText
import io.ktor.server.routing.Route
import io.ktor.server.routing.get

/** baseline: the dispatch floor, with nothing serialised. respondText writes text/plain. */
fun Route.baseline() {
    get("/plaintext") { call.respondText("Hello, World!") }
}
