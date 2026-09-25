package implementation.routes

import implementation.Item
import implementation.Payloads
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.response.header
import io.ktor.server.response.respond
import io.ktor.server.response.respondText
import io.ktor.server.routing.Route
import io.ktor.server.routing.RoutingContext
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import io.ktor.server.routing.post
import io.ktor.server.routing.put
import io.ktor.server.util.getOrFail
import kotlinx.serialization.Serializable

/** An item as a client creates or replaces one. */
@Serializable
data class NewItem(val name: String, val category: String, val priceCents: Int, val inStock: Boolean) {
    fun withId(id: Int) = Item(id, name, category, priceCents, inStock)
}

/** The two fields items.update changes. */
@Serializable
data class ItemPatch(val priceCents: Int? = null, val inStock: Boolean? = null)

/**
 * items: every method on one resource over the rows of items.large. A measured row may not leave
 * the server changed, so the writes store nothing and answer as if they had written. Ktor's router
 * answers a method the path has no route for with 405, and AutoHeadResponse answers HEAD with the GET
 * handler.
 */
fun Route.items(p: Payloads) {
    val created = p.large.count + 1

    /** The row the id in the path names, or null once a 404 has been answered, as Ktor's API tutorial answers one. */
    suspend fun RoutingContext.row(id: Int): Item? =
        p.row(id) ?: run {
            call.respondText("No item with id $id", status = HttpStatusCode.NotFound)
            null
        }

    // The payloads' "items" key reads as this route too.
    // rb:handler items.create
    post("/items") {
        val item = call.receive<NewItem>()
        call.response.header(HttpHeaders.Location, "/items/$created")
        call.respond(HttpStatusCode.Created, item.withId(created))
    }
    // rb:handler items.read,items.head
    // rb:handler errors.not_found
    get("/items/{id}") {
        val row = row(call.parameters.getOrFail<Int>("id")) ?: return@get
        call.respond(row)
    }
    put("/items/{id}") {
        val id = call.parameters.getOrFail<Int>("id")
        call.respond(call.receive<NewItem>().withId(id))
    }
    patch("/items/{id}") {
        val row = row(call.parameters.getOrFail<Int>("id")) ?: return@patch
        val patch = call.receive<ItemPatch>()
        call.respond(row.copy(priceCents = patch.priceCents ?: row.priceCents, inStock = patch.inStock ?: row.inStock))
    }
    delete("/items/{id}") {
        row(call.parameters.getOrFail<Int>("id")) ?: return@delete
        call.respond(HttpStatusCode.NoContent)
    }
}
