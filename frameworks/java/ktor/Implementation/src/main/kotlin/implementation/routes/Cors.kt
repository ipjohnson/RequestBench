package implementation.routes

import implementation.Payloads
import implementation.fresh
import io.ktor.http.HttpMethod
import io.ktor.server.application.install
import io.ktor.server.plugins.cors.routing.CORS
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.route

/**
 * cors: Ktor's CORS plugin on /cors alone. It answers a preflight before any handler runs, and adds
 * its headers to the answer of the request itself. The handler writes x-rb-serial, so its absence on
 * a preflight shows the plugin answered alone.
 */
fun Route.cors(p: Payloads) {
    route("/cors") {
        // rb:wiring cors.*
        install(CORS) {
            allowHost("shop.example.com", schemes = listOf("https"))
            allowMethod(HttpMethod.Get)
            allowHeader("x-rb-tenant")
            maxAgeInSeconds = 600
        }
        // rb:handler cors.request,cors.vary
        get("/small") { call.fresh(); call.respond(p.small) }
    }
}
