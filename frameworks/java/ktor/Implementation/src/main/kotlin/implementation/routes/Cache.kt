package implementation.routes

import implementation.Payloads
import implementation.fresh
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.content.OutgoingContent
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.createRouteScopedPlugin
import io.ktor.server.application.hooks.ResponseBodyReadyForSend
import io.ktor.server.application.install
import io.ktor.server.request.path
import io.ktor.server.response.header
import io.ktor.server.response.respond
import io.ktor.server.response.respondBytes
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.route
import io.ktor.util.AttributeKey
import kotlin.time.Duration
import kotlin.time.Duration.Companion.seconds
import kotlin.time.TimeMark
import kotlin.time.TimeSource

// rb:wiring cache.*
/** One stored answer: the bytes Ktor sent, their type, and the headers the handler wrote. */
internal class Stored(val bytes: ByteArray, val type: ContentType?, val headers: List<Pair<String, String>>, val expires: TimeMark)

/** The one store for the process, sized in entries, dropping the least recently read when it is full. */
class Store(private val capacity: Int, val ttl: Duration) {
    private val entries = object : LinkedHashMap<String, Stored>(capacity, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Stored>) = size > capacity
    }

    internal fun get(key: String): Stored? = synchronized(entries) { entries[key]?.takeIf { it.expires.hasNotPassedNow() } }

    internal fun put(key: String, stored: Stored) = synchronized(entries) { entries[key] = stored }
}

class ResponseCacheConfig {
    lateinit var store: Store

    /** The request headers the stored answer is keyed on, beside the path. */
    var varyOn: List<String> = emptyList()
}

private val Replayed = AttributeKey<Unit>("Replayed")

/**
 * Ktor ships no response cache, so this one is written on Ktor's plugin API. onCall answers from the
 * store before the handler runs. ResponseBodyReadyForSend keeps the bytes the handler's answer
 * became, with the headers the handler wrote, so a replay repeats x-rb-serial.
 */
val ResponseCache = createRouteScopedPlugin("ResponseCache", ::ResponseCacheConfig) {
    val store = pluginConfig.store
    val varyOn = pluginConfig.varyOn
    fun ApplicationCall.key() = (listOf(request.path()) + varyOn.map { request.headers[it].orEmpty() }).joinToString("|")

    onCall { call ->
        val stored = store.get(call.key()) ?: return@onCall
        call.attributes.put(Replayed, Unit)
        stored.headers.forEach { (name, value) -> call.response.header(name, value) }
        call.respondBytes(stored.bytes, stored.type)
    }
    on(ResponseBodyReadyForSend) { call, content ->
        if (call.attributes.contains(Replayed) || content !is OutgoingContent.ByteArrayContent) return@on
        val headers = listOf("x-rb-serial", HttpHeaders.Vary).mapNotNull { name -> call.response.headers[name]?.let { name to it } }
        store.put(call.key(), Stored(content.bytes(), content.contentType, headers, TimeSource.Monotonic.markNow() + store.ttl))
    }
}
// rb:end

/**
 * cache: the handler skipped and a stored answer written back. Each route installs the plugin with
 * the one store and the headers it varies on. The handler writes x-rb-serial, so a replayed answer
 * repeats the serial it was stored with.
 */
fun Route.cache(p: Payloads) {
    // rb:wiring cache.*
    val store = Store(p.settings.cache.capacity, p.settings.cache.ttlSeconds.seconds)
    val one = p.settings.cache.vary.one.keys.toList()
    val many = p.settings.cache.vary.many.keys.toList()
    // rb:end

    // rb:handler cache.small
    route("/cache/small") {
        install(ResponseCache) { this.store = store }
        get { call.fresh(); call.respond(p.small) }
    }
    // rb:handler cache.medium
    route("/cache/medium") {
        install(ResponseCache) { this.store = store }
        get { call.fresh(); call.respond(p.medium) }
    }
    // rb:handler cache.large
    route("/cache/large") {
        install(ResponseCache) { this.store = store }
        get { call.fresh(); call.respond(p.large) }
    }
    // The Vary header tells a cache in front of the framework what the answer depends on. The store
    // keys on the route's own list.
    // rb:handler cache.vary_one
    route("/cache/vary/one") {
        install(ResponseCache) { this.store = store; varyOn = one }
        get { call.fresh(); call.response.header(HttpHeaders.Vary, one.joinToString(", ")); call.respond(p.small) }
    }
    // rb:handler cache.vary_many
    route("/cache/vary/many") {
        install(ResponseCache) { this.store = store; varyOn = many }
        get { call.fresh(); call.response.header(HttpHeaders.Vary, many.joinToString(", ")); call.respond(p.small) }
    }
}
