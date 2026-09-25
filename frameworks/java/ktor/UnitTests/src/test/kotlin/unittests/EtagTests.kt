package unittests

import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.statement.bodyAsBytes
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource

class EtagTests {
    // rb:test etag.small,etag.large
    @ParameterizedTest
    @Tag("etag.small")
    @Tag("etag.large")
    @ValueSource(strings = ["small", "large"])
    fun `the answer carries the tag the plugin computed`(size: String) = corpusTest {
        val response = client.get("/etag/$size")

        assertEquals(HttpStatusCode.OK, response.status)
        assertTrue(response.headers[HttpHeaders.ETag]!!.startsWith("\""))
        assertEquals(Expected.json("items.$size.json"), response.json())
    }

    // rb:test etag.match_large
    @Test
    @Tag("etag.match_large")
    fun `a matching if-none-match is 304 with no body after the handler ran`() = corpusTest {
        val first = client.get("/etag/large")

        val response = client.get("/etag/large") { header(HttpHeaders.IfNoneMatch, first.headers[HttpHeaders.ETag]!!) }

        assertEquals(HttpStatusCode.NotModified, response.status)
        assertContentEquals(ByteArray(0), response.bodyAsBytes())
        assertTrue(response.headers["x-rb-serial"]!!.toLong() > first.headers["x-rb-serial"]!!.toLong())
    }

    // rb:test etag.stale_large
    @Test
    @Tag("etag.stale_large")
    fun `a tag that does not match is answered in full`() = corpusTest {
        val response = client.get("/etag/large") { header(HttpHeaders.IfNoneMatch, Expected.settings["staleEtag"]!!.jsonPrimitive.content) }

        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals(Expected.json("items.large.json"), response.json())
    }

    @Test
    fun `a tag in a list matches`() = corpusTest {
        val tag = client.get("/etag/small").headers[HttpHeaders.ETag]!!

        assertEquals(HttpStatusCode.NotModified, client.get("/etag/small") { header(HttpHeaders.IfNoneMatch, "\"other\", $tag") }.status)
    }

    @Test
    fun `a route outside the family carries no tag`() = corpusTest {
        assertNull(client.get("/json/small").headers[HttpHeaders.ETag])
    }
}
