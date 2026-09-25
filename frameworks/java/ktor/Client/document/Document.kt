package client

import implementation.Payloads
import implementation.corpus
import io.ktor.openapi.OpenApiDoc
import io.ktor.openapi.OpenApiInfo
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.routing.openapi.plus
import io.ktor.server.routing.routingRoot
import kotlin.io.path.Path
import kotlin.io.path.writeText
import kotlinx.serialization.json.Json

/**
 * Writes the OpenAPI document Ktor assembles from the application's routing tree to the path it is
 * given, as Ktor's OpenAPI guide assembles one from routingRoot.descendants(). The metadata on each
 * route is what the Ktor compiler plugin inferred from the handlers while Implementation compiled
 * under -Pclient. The application is started on a free port, because its routing is built when it
 * starts, and stopped once the document is written.
 */
fun main(args: Array<String>) {
    val payloads = Payloads.load(Path(System.getenv("RB_PAYLOADS") ?: error("RB_PAYLOADS has to name the payload directory")))
    val server = embeddedServer(Netty, port = 0) { corpus(payloads) }.start()
    try {
        val document = OpenApiDoc(info = OpenApiInfo("Ktor", "0.0.0")) + server.application.routingRoot.descendants()
        Path(args.single()).writeText(Json { prettyPrint = true }.encodeToString(document) + "\n")
    } finally {
        server.stop()
    }
}
