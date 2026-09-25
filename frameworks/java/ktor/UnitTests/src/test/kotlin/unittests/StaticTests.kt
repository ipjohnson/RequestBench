package unittests

import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsBytes
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test

class StaticTests {
    // rb:test static.file
    @Test
    @Tag("static.file")
    fun `the committed file is served byte for byte with its last modified`() = corpusTest {
        val file = Expected.raw("items.large.json")

        val response = client.get("/static/items.large.json")

        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals(ContentType.Application.Json, response.contentType()?.withoutParameters())
        assertEquals(file.size.toString(), response.headers[HttpHeaders.ContentLength])
        assertNotNull(response.headers[HttpHeaders.LastModified])
        assertContentEquals(file, response.bodyAsBytes())
    }
}
