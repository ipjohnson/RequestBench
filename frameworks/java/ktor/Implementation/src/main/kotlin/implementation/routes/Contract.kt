package implementation.routes

import io.ktor.server.application.Application
import io.ktor.server.response.respond
import io.ktor.server.response.respondText
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.netty.util.Version
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class Meta(val framework: String, val version: String?, val runtime: String, val adapter: String, val serializer: String)

/** The version the manifest of the jar that holds this class records. */
private fun versionOf(type: Class<*>) = type.`package`.implementationVersion

private val META = Meta(
    framework = "Ktor",
    version = versionOf(Application::class.java),
    runtime = "Java ${Runtime.version()}, Kotlin ${KotlinVersion.CURRENT}",
    adapter = "Netty ${Version.identify()["netty-codec-http"]?.artifactVersion()}",
    serializer = "kotlinx.serialization ${versionOf(Json::class.java)}",
)

/** /health and /__meta, which the contract asks of every framework outside the corpus. */
fun Route.contract() {
    // The payloads are loaded before Netty listens, so a server that answers has them.
    get("/health") { call.respondText("ok") }
    get("/__meta") { call.respond(META) }
}
