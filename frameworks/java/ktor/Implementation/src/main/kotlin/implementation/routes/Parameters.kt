package implementation.routes

import implementation.Payloads
import implementation.echoed
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.util.getOrFail
import kotlinx.serialization.Serializable

@Serializable
data class One(val one: Int)

@Serializable
data class Two(val one: Int, val two: Int)

/**
 * parameters: path captures, each converted to an Int by getOrFail, which runs Ktor's data conversion
 * and refuses a value that is missing or does not convert with 400. Ktor's router tries a constant
 * segment before a capture.
 */
fun Route.parameters(p: Payloads) {
    get("/parameters/static/segment/literal") { call.respond(p.small) }
    get("/parameters/{one}/segment/literal") {
        call.respond(p.small.echoed(One(call.parameters.getOrFail<Int>("one"))))
    }
    get("/parameters/{one}/with-second/{two}") {
        call.respond(p.small.echoed(Two(call.parameters.getOrFail<Int>("one"), call.parameters.getOrFail<Int>("two"))))
    }
}
