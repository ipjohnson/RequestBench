package implementation.routes

import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.install
import io.ktor.server.plugins.requestvalidation.RequestValidation
import io.ktor.server.plugins.requestvalidation.RequestValidationConfig
import io.ktor.server.plugins.requestvalidation.ValidationResult
import io.ktor.server.request.contentLength
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import kotlinx.serialization.Serializable

@Serializable
data class Line(val productId: Int, val qty: Int)

/** The body the bind and validate rows send. */
@Serializable
data class Order(val customerId: Int, val status: String, val lines: List<Line>)

/** What a bind or validate row answers: the order back, with the leaves found in it and the bytes received. */
@Serializable
data class Bound(val fields: Int, val bytes: Long, val echo: Order)

// rb:wiring body.*
/**
 * The rules orderRequest states, each broken one a reason that starts with the field it is about.
 * The sequence is lazy, so a reader that stops at the first reason checks no rule after it.
 */
fun Order.broken(): Sequence<String> = sequence {
    if (customerId < 1) yield("customerId must be at least 1")
    if (status.isEmpty()) yield("status must not be empty")
    if (lines.isEmpty()) yield("lines must not be empty")
    lines.forEachIndexed { i, line ->
        if (line.productId < 1) yield("lines[$i].productId must be at least 1")
        if (line.qty < 1) yield("lines[$i].qty must be at least 1")
    }
}

/** RequestValidation on a validate route: every rule the order breaks is a reason. */
private val everyRule: RequestValidationConfig.() -> Unit = {
    validate<Order> { order ->
        val reasons = order.broken().toList()
        if (reasons.isEmpty()) ValidationResult.Valid else ValidationResult.Invalid(reasons)
    }
}

/**
 * RequestValidation on the first-error route. RequestValidation runs whatever check it is given, and
 * this one stops at the first rule the order breaks.
 */
private val firstRule: RequestValidationConfig.() -> Unit = {
    validate<Order> { order ->
        order.broken().firstOrNull()?.let { ValidationResult.Invalid(it) } ?: ValidationResult.Valid
    }
}
// rb:end

/** customerId and status, and a productId and a qty per line. */
private fun ApplicationCall.bound(order: Order) = Bound(2 + 2 * order.lines.size, request.contentLength() ?: 0, order)

/**
 * body: the order read by ContentNegotiation's kotlinx.serialization converter on every route, and
 * checked by RequestValidation on the validate routes as it is received. A body that is not JSON, or
 * does not bind, is Ktor's BadRequestException, which it answers with 400 before any rule runs.
 */
fun Route.body() {
    post("/body/bind/small") { call.respond(call.bound(call.receive<Order>())) }
    post("/body/bind/medium") { call.respond(call.bound(call.receive<Order>())) }
    // rb:handler body.validate_small,body.rejected_all,errors.malformed
    route("/body/validate/small") {
        install(RequestValidation, everyRule)
        post { call.respond(call.bound(call.receive<Order>())) }
    }
    // rb:handler body.validate_medium
    route("/body/validate/medium") {
        install(RequestValidation, everyRule)
        post { call.respond(call.bound(call.receive<Order>())) }
    }
    // rb:handler body.rejected_first
    route("/body/validate/first-error") {
        install(RequestValidation, firstRule)
        post { call.respond(call.bound(call.receive<Order>())) }
    }
}
