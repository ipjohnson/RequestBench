package implementation.routes

import implementation.Payloads
import io.ktor.server.application.install
import io.ktor.server.http.content.staticFiles
import io.ktor.server.plugins.conditionalheaders.ConditionalHeaders
import io.ktor.server.routing.Route
import io.ktor.server.routing.route

/**
 * static: staticFiles, Ktor's file serving, over the payload directory. The file's Last-Modified is
 * written by ConditionalHeaders, from the version Ktor's file content carries. ConditionalHeaders
 * keeps the version providers of its last install for every route that installs it, so this one
 * installs the etag routes' body tag too, which tags no file.
 */
fun Route.statics(p: Payloads) {
    // rb:handler static.file
    // rb:wiring static.*
    route("/static") {
        install(ConditionalHeaders, bodyTag)
        staticFiles("", p.directory.toFile())
    }
}
