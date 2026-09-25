package implementation

import implementation.routes.authorized
import implementation.routes.baseline
import implementation.routes.body
import implementation.routes.cache
import implementation.routes.compressed
import implementation.routes.contract
import implementation.routes.cors
import implementation.routes.etag
import implementation.routes.forms
import implementation.routes.headers
import implementation.routes.items
import implementation.routes.json
import implementation.routes.middleware
import implementation.routes.parameters
import implementation.routes.query
import implementation.routes.sse
import implementation.routes.statics
import implementation.routes.stream
import implementation.routes.template
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.netty.EngineMain
import io.ktor.server.plugins.autohead.AutoHeadResponse
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.plugins.requestvalidation.RequestValidationException
import io.ktor.server.plugins.statuspages.StatusPages
import io.ktor.server.response.respond
import io.ktor.server.routing.routing
import io.ktor.server.sse.SSE
import io.ktor.server.thymeleaf.Thymeleaf
import kotlin.io.path.Path
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver

/** Netty, started by EngineMain from application.conf, as a Ktor project configured in a file starts. */
fun main(args: Array<String>) = EngineMain.main(args)

/** The module application.conf names. The payloads are loaded before Netty listens. */
fun Application.module() {
    val directory = System.getenv("RB_PAYLOADS") ?: error("RB_PAYLOADS has to name the payload directory")
    corpus(Payloads.load(Path(directory)))
}

/**
 * Every route the corpus calls. The plugins installed here serve the whole application, and each
 * family installs its own route-scoped plugins on its own routes.
 */
fun Application.corpus(p: Payloads) {
    // kotlinx.serialization's JSON, as Ktor's project generator sets it up.
    install(ContentNegotiation) {
        json()
    }
    // rb:wiring body.*
    // RequestValidation throws when a body breaks a rule. Its documentation answers the exception
    // through StatusPages with the reasons, here as JSON.
    install(StatusPages) {
        exception<RequestValidationException> { call, cause ->
            call.respond(HttpStatusCode.BadRequest, cause.reasons)
        }
    }
    // rb:end
    // rb:wiring items.*
    // HEAD on every GET route, answered by the GET handler with the body left out.
    install(AutoHeadResponse)
    // rb:wiring sse.*
    install(SSE)
    // rb:wiring template.*
    install(Thymeleaf) {
        setTemplateResolver(ClassLoaderTemplateResolver().apply {
            prefix = "templates/"
            suffix = ".html"
            characterEncoding = "utf-8"
        })
    }
    // rb:end
    authorized(p)

    routing {
        baseline()
        json(p)
        middleware(p)
        parameters(p)
        query(p)
        headers(p)
        body()
        items(p)
        cache(p)
        etag(p)
        compressed(p)
        cors(p)
        forms(p)
        stream(p)
        sse(p)
        template(p)
        statics(p)
        contract()
    }
}
