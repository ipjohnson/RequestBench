package implementation.routes

import implementation.Payloads
import io.ktor.serialization.kotlinx.json.DefaultJson
import io.ktor.server.routing.Route
import io.ktor.server.sse.send
import io.ktor.server.sse.sse
import kotlinx.serialization.serializer

/**
 * sse: items.medium's rows as server-sent events, through Ktor's SSE plugin. Each row sent is the data
 * of one event, encoded by the serialize function the route names, which uses the Json instance
 * ContentNegotiation's json() uses.
 */
fun Route.sse(p: Payloads) {
    // rb:handler sse.medium
    sse("/sse/medium", serialize = { type, value -> DefaultJson.encodeToString(DefaultJson.serializersModule.serializer(type.kotlinType!!), value) }) {
        for (row in p.medium.items) send(row)
    }
}
