package implementation.routes

import implementation.Payloads
import implementation.fresh
import io.ktor.http.content.EntityTagVersion
import io.ktor.http.content.OutgoingContent
import io.ktor.server.application.install
import io.ktor.server.plugins.conditionalheaders.ConditionalHeaders
import io.ktor.server.plugins.conditionalheaders.ConditionalHeadersConfig
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.route
import io.ktor.util.hex
import io.ktor.util.sha1

// rb:wiring etag.*
/**
 * ConditionalHeaders with a version for the body: Ktor's own SHA-1 of the bytes the answer became,
 * as its entity tag. The plugin writes the ETag and answers an If-None-Match that names it with 304.
 * The handler has run and the body has been encoded by then, so a 304 saves the write and nothing
 * else.
 */
val bodyTag: ConditionalHeadersConfig.() -> Unit = {
    version { _, content ->
        if (content is OutgoingContent.ByteArrayContent) listOf(EntityTagVersion(hex(sha1(content.bytes())))) else emptyList()
    }
}
// rb:end

/** etag: ConditionalHeaders on these two routes alone. */
fun Route.etag(p: Payloads) {
    // rb:handler etag.small
    route("/etag/small") {
        install(ConditionalHeaders, bodyTag)
        get { call.fresh(); call.respond(p.small) }
    }
    // rb:handler etag.large,etag.match_large,etag.stale_large
    route("/etag/large") {
        install(ConditionalHeaders, bodyTag)
        get { call.fresh(); call.respond(p.large) }
    }
}
