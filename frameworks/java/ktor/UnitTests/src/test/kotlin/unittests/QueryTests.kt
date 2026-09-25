package unittests

import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.http.HttpStatusCode
import kotlin.test.assertEquals
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test

class QueryTests {
    // rb:test query.one
    @Test
    @Tag("query.one")
    fun `the page is echoed as an Int`() = corpusTest {
        val response = client.get("/query/one") { parameter("page", "417") }

        assertEquals(Expected.withEcho("items.small.json", buildJsonObject { put("page", JsonPrimitive(417)) }), response.json())
    }

    // rb:test query.many
    @Test
    @Tag("query.many")
    fun `eight values are echoed the numbers as Ints`() = corpusTest {
        val response = client.get("/query/many") { Expected.SEARCH.forEach { (name, value) -> parameter(name, value) } }

        assertEquals(Expected.withEcho("items.small.json", Expected.SEARCH_ECHO), response.json())
    }

    @Test
    fun `a missing value is refused with 400`() = corpusTest {
        assertEquals(HttpStatusCode.BadRequest, client.get("/query/one").status)
    }
}
