package implementation

import java.nio.file.Path
import kotlin.io.path.readText
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class Item(val id: Int, val name: String, val category: String, val priceCents: Int, val inStock: Boolean)

@Serializable
data class Payload(val size: String, val count: Int, val items: List<Item>)

/** A payload with the values a handler bound written back beside its own fields. */
@Serializable
data class Echoed<E>(val size: String, val count: Int, val items: List<Item>, val echo: E)

fun <E> Payload.echoed(echo: E) = Echoed(size, count, items, echo)

@Serializable
data class Settings(val token: String, val wrongToken: String, val staleEtag: String, val cache: CacheSettings, val cors: CorsSettings)

@Serializable
data class CacheSettings(val capacity: Int, val ttlSeconds: Long, val vary: VarySettings)

/** The request headers each vary row is keyed on, each with the values the corpus sends. */
@Serializable
data class VarySettings(val one: Map<String, List<String>>, val many: Map<String, List<String>>)

@Serializable
data class CorsSettings(val origin: String, val method: String, val header: String, val maxAgeSeconds: Long)

/**
 * The committed payloads, read from the directory RB_PAYLOADS names before Netty listens, so a
 * missing or broken file stops the boot rather than failing a request. Each is kept as the objects
 * kotlinx.serialization decoded, and encoded again on every request.
 */
class Payloads(val directory: Path, val small: Payload, val medium: Payload, val large: Payload, val settings: Settings) {
    private val rows = large.items.associateBy { it.id }

    /** The row of items.large with this id, or null when there is none. */
    fun row(id: Int): Item? = rows[id]

    companion object {
        fun load(directory: Path): Payloads {
            val root = directory.toAbsolutePath().normalize()
            fun payload(name: String): Payload = Json.decodeFromString(root.resolve(name).readText())
            return Payloads(
                root,
                payload("items.small.json"),
                payload("items.medium.json"),
                payload("items.large.json"),
                Json.decodeFromString(root.resolve("settings.json").readText()),
            )
        }
    }
}
