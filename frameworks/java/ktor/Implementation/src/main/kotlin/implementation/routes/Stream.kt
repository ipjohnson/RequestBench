package implementation.routes

import implementation.Payloads
import io.ktor.http.ContentType
import io.ktor.serialization.kotlinx.json.DefaultJson
import io.ktor.server.response.respondTextWriter
import io.ktor.server.routing.Route
import io.ktor.server.routing.get

private val NDJSON = ContentType("application", "x-ndjson")

/**
 * stream: items.medium's rows written one per line, each flushed as it is produced. respondTextWriter
 * hands the handler a writer over the response, which Netty sends chunked. Each row is encoded by the
 * Json instance ContentNegotiation's json() uses.
 */
fun Route.stream(p: Payloads) {
    get("/stream/items") {
        call.respondTextWriter(NDJSON) {
            for (row in p.medium.items) {
                write(DefaultJson.encodeToString(row))
                write("\n")
                flush()
            }
        }
    }
}
