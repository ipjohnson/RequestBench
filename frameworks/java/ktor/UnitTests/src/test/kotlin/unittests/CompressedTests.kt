package unittests

import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsBytes
import io.ktor.http.HttpHeaders
import io.ktor.server.testing.ApplicationTestBuilder
import java.util.zip.GZIPInputStream
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.serialization.json.Json
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource

private suspend fun ApplicationTestBuilder.get(size: String, encoding: String): HttpResponse =
    client.get("/compressed/$size") {
        header(HttpHeaders.AcceptEncoding, encoding)
        header(HttpHeaders.CacheControl, "no-cache")
    }

class CompressedTests {
    // rb:test compressed.gzip_large
    @Test
    @Tag("compressed.gzip_large")
    fun `a large body is gzipped when asked`() = corpusTest {
        val response = get("large", "gzip")

        assertEquals("gzip", response.headers[HttpHeaders.ContentEncoding])
        val body = GZIPInputStream(response.bodyAsBytes().inputStream()).readBytes().decodeToString()
        assertEquals(Expected.json("items.large.json"), Json.parseToJsonElement(body))
    }

    // rb:test compressed.gzip_small
    @Test
    @Tag("compressed.gzip_small")
    fun `a body under 200 bytes goes out as it is`() = corpusTest {
        val response = get("small", "gzip")

        assertNull(response.headers[HttpHeaders.ContentEncoding])
        assertEquals(Expected.json("items.small.json"), response.json())
    }

    // rb:test compressed.identity_small,compressed.identity_large
    @ParameterizedTest
    @Tag("compressed.identity_small")
    @Tag("compressed.identity_large")
    @ValueSource(strings = ["small", "large"])
    fun `identity is answered as it is and the handler runs every time`(size: String) = corpusTest {
        val first = get(size, "identity")
        val second = get(size, "identity")

        assertTrue(second.headers[HttpHeaders.ContentEncoding] in setOf(null, "identity"))
        assertEquals(Expected.json("items.$size.json"), second.json())
        assertTrue(second.headers["x-rb-serial"]!!.toLong() > first.headers["x-rb-serial"]!!.toLong())
    }

    @Test
    fun `a route outside the family is not compressed`() = corpusTest {
        assertNull(client.get("/json/large") { header(HttpHeaders.AcceptEncoding, "gzip") }.headers[HttpHeaders.ContentEncoding])
    }
}
