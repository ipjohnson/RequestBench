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
import java.net.URI

/**
 * cors: Ktor's CORS plugin on /cors alone. It answers a preflight before any handler runs, and adds
 * its headers to the answer of the request itself. The handler writes x-rb-serial, so its absence on
 * a preflight shows the plugin answered alone.
 */
fun Route.cors(p: Payloads) {
    val cors = p.settings.cors
    route("/cors") {
        // rb:wiring cors.*
        install(CORS) {
            val origin = URI(cors.origin)
            allowHost(origin.authority, schemes = listOf(origin.scheme))
            allowMethod(HttpMethod.parse(cors.method))
            allowHeader(cors.header)
            maxAgeInSeconds = cors.maxAgeSeconds
        }
        // rb:handler cors.request,cors.vary
        get("/small") { call.fresh(); call.respond(p.small) }
    }
}
