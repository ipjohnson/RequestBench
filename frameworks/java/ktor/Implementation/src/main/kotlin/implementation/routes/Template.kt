package implementation.routes

import implementation.Payload
import implementation.Payloads
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.thymeleaf.ThymeleafContent

private fun page(payload: Payload) =
    ThymeleafContent("items", mapOf("size" to payload.size, "count" to payload.count, "items" to payload.items))

/**
 * template: the payload rendered by Thymeleaf through Ktor's Thymeleaf plugin, as Ktor's website
 * tutorial renders its pages. Thymeleaf parses the template on its first use and keeps it.
 */
fun Route.template(p: Payloads) {
    get("/template/small") { call.respond(page(p.small)) }
    get("/template/medium") { call.respond(page(p.medium)) }
}
