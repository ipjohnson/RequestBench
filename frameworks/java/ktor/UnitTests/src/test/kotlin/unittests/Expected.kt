package unittests

import java.nio.file.Path
import kotlin.io.path.Path
import kotlin.io.path.exists
import kotlin.io.path.readBytes
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/** What an answer has to be, read from the committed payloads rather than from the Implementation. */
object Expected {
    /** The directory RB_PAYLOADS names, or tests/payloads found by walking up from the module. */
    val DIRECTORY: Path = System.getenv("RB_PAYLOADS")?.takeIf { it.isNotEmpty() }?.let { Path(it).toAbsolutePath().normalize() }
        ?: generateSequence(Path("").toAbsolutePath()) { it.parent }
            .map { it.resolve("tests").resolve("payloads") }
            .firstOrNull { it.resolve("items.large.json").exists() }
        ?: error("RB_PAYLOADS is not set and there is no tests/payloads above ${Path("").toAbsolutePath()}")

    /** The values a run draws, fixed as orchestrator/test/reference.ts fixes them. */
    const val ONE = 4821
    const val TWO = 7390
    const val TENANT = "qwertyuiopas"
    const val REQUEST_ID = "0123456789abcdef"
    const val ACCOUNT = 482913

    /** query.many's eight values, as a run might draw them, each as the request sends it. */
    val SEARCH = linkedMapOf(
        "page" to "417", "size" to "38", "status" to "paid", "category" to "garden",
        "sort" to "created", "q" to "alpha bravo", "minPrice" to "1200", "maxPrice" to "34000",
    )

    /** The echo a handler that read SEARCH answers with, the numbers as numbers. */
    val SEARCH_ECHO = JsonObject(SEARCH.mapValues { (name, value) ->
        if (name in setOf("page", "size", "minPrice", "maxPrice")) JsonPrimitive(value.toInt()) else JsonPrimitive(value)
    })

    fun raw(file: String): ByteArray = DIRECTORY.resolve(file).readBytes()

    fun json(file: String): JsonElement = Json.parseToJsonElement(raw(file).decodeToString())

    val settings: JsonObject get() = json("settings.json").jsonObject

    /** A payload with an echo object beside its own fields, as a binding handler answers. */
    fun withEcho(file: String, echo: JsonObject) = JsonObject(json(file).jsonObject + ("echo" to echo))

    fun row(id: Int): JsonObject = json("items.large.json").jsonObject["items"]!!.jsonArray.first { it.jsonObject["id"]!!.jsonPrimitive.int == id }.jsonObject

    /** The page the template rows render, as tests/payloads/index.ts writes it. */
    fun page(file: String): String {
        val payload = json(file).jsonObject
        val rows = payload["items"]!!.jsonArray.joinToString("") {
            val item = it.jsonObject
            fun cell(name: String) = item[name]!!.jsonPrimitive.content
            "<tr><td>${cell("id")}</td><td>${cell("name")}</td><td>${cell("category")}</td><td>${cell("priceCents")}</td>" +
                "<td>${if (item["inStock"]!!.jsonPrimitive.boolean) "yes" else "no"}</td></tr>"
        }
        return "<!doctype html><html><head><title>items</title></head><body>" +
            "<h1>${payload["size"]!!.jsonPrimitive.content}</h1><table><thead><tr><th>id</th><th>name</th><th>category</th><th>price</th><th>stock</th></tr></thead>" +
            "<tbody>$rows</tbody></table><p>${payload["count"]!!.jsonPrimitive.content} rows</p></body></html>"
    }

    /** Whitespace at an element boundary removed and every other run collapsed, as the corpus compares a page. */
    fun normal(html: String): String =
        html.replace(Regex("[ \\t\\n\\r\\f\\u000B]+"), " ").replace(Regex(">[ ]+"), ">").replace(Regex("[ ]+<"), "<").trim()
}
