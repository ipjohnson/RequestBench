package unittests

import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.jsonObject
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test

class StreamTests {
    // rb:test stream.ndjson
    @Test
    @Tag("stream.ndjson")
    fun `each row of items medium is a line with no length`() = corpusTest {
        val response = client.get("/stream/items")

        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals(ContentType("application", "x-ndjson"), response.contentType()?.withoutParameters())
        assertNull(response.headers[HttpHeaders.ContentLength])
        val rows = response.bodyAsText().lines().filter { it.isNotEmpty() }.map(Json::parseToJsonElement)
        assertEquals(Expected.json("items.medium.json").jsonObject["items"], JsonArray(rows))
    }
}
