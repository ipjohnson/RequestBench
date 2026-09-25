package unittests

import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import kotlin.test.assertEquals
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.jsonObject
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test

class SseTests {
    // rb:test sse.medium
    @Test
    @Tag("sse.medium")
    fun `each row of items medium is the data of one event`() = corpusTest {
        val response = client.get("/sse/medium") { header(HttpHeaders.Accept, "text/event-stream") }

        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals(ContentType.Text.EventStream, response.contentType()?.withoutParameters())
        // Each event is one data line and a blank line, and Ktor ends every line with CRLF.
        val events = response.bodyAsText().lines().filter { it.startsWith("data: ") }.map { Json.parseToJsonElement(it.removePrefix("data: ")) }
        assertEquals(Expected.json("items.medium.json").jsonObject["items"], JsonArray(events))
    }
}
