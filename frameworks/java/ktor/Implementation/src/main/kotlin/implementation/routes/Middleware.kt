package implementation.routes

import implementation.Payloads
import io.ktor.server.application.createRouteScopedPlugin
import io.ktor.server.application.install
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.route

// rb:wiring middleware.*
/**
 * Sixteen no-op layers, each a route-scoped plugin whose onCall handler does nothing, so Ktor carries
 * on to the next and then to the handler. A route installs a plugin once, so each layer is a plugin
 * of its own.
 */
private val layers = List(16) { n -> createRouteScopedPlugin("Layer$n") { onCall { } } }
// rb:end

/** middleware: no-op layers in front of the handler, installed on the route that has them. */
fun Route.middleware(p: Payloads) {
    get("/middleware/none") { call.respond(p.small) }
    // rb:handler middleware.four
    route("/middleware/four") {
        layers.take(4).forEach { install(it) }
        get { call.respond(p.small) }
    }
    // rb:handler middleware.sixteen
    route("/middleware/sixteen") {
        layers.forEach { install(it) }
        get { call.respond(p.small) }
    }
}
