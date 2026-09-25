package implementation.routes

import implementation.Payloads
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get

/**
 * json: a payload the framework already holds, encoded by ContentNegotiation's kotlinx.serialization
 * converter on every request. Three static routes rather than one with a capture, so the router pays
 * no capture here.
 */
fun Route.json(p: Payloads) {
    get("/json/small") { call.respond(p.small) }
    get("/json/medium") { call.respond(p.medium) }
    get("/json/large") { call.respond(p.large) }
}
