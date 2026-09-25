package unittests

import implementation.Payloads
import implementation.corpus
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.server.config.MapApplicationConfig
import io.ktor.server.testing.ApplicationTestBuilder
import io.ktor.server.testing.testApplication
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement

/** The payloads, loaded once for every test, as the module loads them before Netty listens. */
val PAYLOADS: Payloads = Payloads.load(Expected.DIRECTORY)

/**
 * The Implementation under Ktor's test engine, as Ktor's testing guide runs an application: every
 * request goes through the routing and the plugins, with no socket. The config is empty, so
 * application.conf's module, which reads RB_PAYLOADS, does not run as well.
 */
fun corpusTest(block: suspend ApplicationTestBuilder.() -> Unit) = testApplication {
    environment { config = MapApplicationConfig() }
    application { corpus(PAYLOADS) }
    block()
}

suspend fun HttpResponse.json(): JsonElement = Json.parseToJsonElement(bodyAsText())
