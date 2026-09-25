package implementation.routes

import implementation.Payloads
import implementation.echoed
import io.ktor.http.content.PartData
import io.ktor.http.content.forEachPart
import io.ktor.server.plugins.BadRequestException
import io.ktor.server.request.receiveMultipart
import io.ktor.server.request.receiveParameters
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.post
import io.ktor.utils.io.discard
import kotlinx.serialization.Serializable

@Serializable
data class UploadedFile(val name: String, val bytes: Long)

@Serializable
data class UploadEcho(val tenant: String, val requestId: String)

@Serializable
data class Uploaded(val file: UploadedFile, val echo: UploadEcho)

/**
 * forms: the same eight values query.many reads, from a urlencoded body, and an upload.
 * receiveParameters parses the form, and receiveMultipart hands the handler each part in turn.
 */
fun Route.forms(p: Payloads) {
    post("/forms/urlencoded") { call.respond(p.small.echoed(call.receiveParameters().search())) }
    post("/forms/multipart") {
        val fields = mutableMapOf<String, String>()
        var file: UploadedFile? = null
        call.receiveMultipart().forEachPart { part ->
            when (part) {
                is PartData.FormItem -> fields[part.name.orEmpty()] = part.value
                // The upload is read to its end, and its length counted as it is read.
                is PartData.FileItem -> file = UploadedFile(part.originalFileName.orEmpty(), part.provider().discard())
                else -> {}
            }
            part.dispose()
        }
        fun field(name: String) = fields[name] ?: throw BadRequestException("$name is missing")
        call.respond(Uploaded(file ?: throw BadRequestException("file is missing"), UploadEcho(field("tenant"), field("requestId"))))
    }
}
