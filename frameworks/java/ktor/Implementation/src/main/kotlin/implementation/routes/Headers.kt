package implementation.routes

import implementation.Payloads
import implementation.echoed
import io.ktor.server.plugins.BadRequestException
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import kotlinx.serialization.Serializable

@Serializable
data class Caller(val tenant: String, val requestId: String, val account: Int)

/**
 * headers: /headers reads no header, and /headers/bind reads three. Ktor binds no header, so the
 * handler reads each by name and converts the account itself. A header that is missing or no Int is
 * Ktor's BadRequestException, which it answers with 400.
 */
fun Route.headers(p: Payloads) {
    get("/headers") { call.respond(p.small) }
    get("/headers/bind") {
        val headers = call.request.headers
        fun read(name: String) = headers[name] ?: throw BadRequestException("$name is missing")
        val account = read("x-rb-account").toIntOrNull() ?: throw BadRequestException("x-rb-account is no Int")
        call.respond(p.small.echoed(Caller(read("x-rb-tenant"), read("x-rb-request-id"), account)))
    }
}
