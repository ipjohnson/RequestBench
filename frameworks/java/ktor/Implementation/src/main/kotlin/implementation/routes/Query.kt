package implementation.routes

import implementation.Payloads
import implementation.echoed
import io.ktor.http.Parameters
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.util.getOrFail
import kotlinx.serialization.Serializable

@Serializable
data class Page(val page: Int)

/** query.many's eight values, which forms.urlencoded posts as a form. */
@Serializable
data class Search(
    val page: Int,
    val size: Int,
    val status: String,
    val category: String,
    val sort: String,
    val q: String,
    val minPrice: Int,
    val maxPrice: Int,
)

/** Each value read by name with getOrFail, the numbers converted by Ktor's data conversion. */
fun Parameters.search() = Search(
    getOrFail<Int>("page"),
    getOrFail<Int>("size"),
    getOrFail("status"),
    getOrFail("category"),
    getOrFail("sort"),
    getOrFail("q"),
    getOrFail<Int>("minPrice"),
    getOrFail<Int>("maxPrice"),
)

/** query: the query string Ktor parsed, each value read by name and converted as it is read. */
fun Route.query(p: Payloads) {
    get("/query/one") { call.respond(p.small.echoed(Page(call.request.queryParameters.getOrFail<Int>("page")))) }
    get("/query/many") { call.respond(p.small.echoed(call.request.queryParameters.search())) }
}
