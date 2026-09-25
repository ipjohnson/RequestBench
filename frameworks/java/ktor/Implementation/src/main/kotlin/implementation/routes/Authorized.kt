package implementation.routes

import implementation.Payloads
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.createRouteScopedPlugin
import io.ktor.server.application.install
import io.ktor.server.auth.Authentication
import io.ktor.server.auth.AuthenticationChecked
import io.ktor.server.auth.UserIdPrincipal
import io.ktor.server.auth.authenticate
import io.ktor.server.auth.bearer
import io.ktor.server.auth.principal
import io.ktor.server.response.respond
import io.ktor.server.response.respondText
import io.ktor.server.routing.get
import io.ktor.server.routing.routing

// rb:wiring authorized.*
class TokenCheckConfig {
    lateinit var token: String
}

/**
 * Authorization, as Ktor's documentation writes it: a route-scoped plugin on the AuthenticationChecked
 * hook, which answers 403 when the authenticated caller may not have the route.
 */
private val TokenCheck = createRouteScopedPlugin("TokenCheck", ::TokenCheckConfig) {
    val token = pluginConfig.token
    on(AuthenticationChecked) { call ->
        if (call.principal<UserIdPrincipal>()?.name != token) {
            call.respondText("You are not allowed to visit this page", status = HttpStatusCode.Forbidden)
        }
    }
}
// rb:end

/**
 * authorized: Ktor's Authentication plugin reads the bearer token, and makes it the caller's identity.
 * The TokenCheck plugin then refuses any token but settings.json's with 403. A request with no bearer
 * token is not authenticated, which Ktor answers with 401.
 */
fun Application.authorized(p: Payloads) {
    // rb:wiring authorized.*
    install(Authentication) {
        bearer("token") {
            authenticate { credential -> UserIdPrincipal(credential.token) }
        }
    }
    // rb:end
    routing {
        authenticate("token") {
            install(TokenCheck) { token = p.settings.token }
            get("/authorized/small") { call.respond(p.small) }
        }
    }
}
