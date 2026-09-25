package implementation.routes

import implementation.Payloads
import implementation.fresh
import io.ktor.server.application.install
import io.ktor.server.plugins.compression.Compression
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.route

/**
 * compressed: Ktor's Compression on these two routes alone, with its defaults: gzip and deflate for
 * a body of 200 bytes or more. Ktor compresses at the JDK Deflater's default level, 6, and has no
 * setting for it.
 */
fun Route.compressed(p: Payloads) {
    // rb:handler compressed.gzip_small,compressed.identity_small
    route("/compressed/small") {
        // rb:wiring compressed.*
        install(Compression)
        get { call.fresh(); call.respond(p.small) }
    }
    // rb:handler compressed.gzip_large,compressed.identity_large
    route("/compressed/large") {
        // rb:wiring compressed.*
        install(Compression)
        get { call.fresh(); call.respond(p.large) }
    }
}
