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
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource

class StaticTests {
    // rb:test static.small,static.medium,static.large
    @ParameterizedTest
    @Tag("static.small")
    @Tag("static.medium")
    @Tag("static.large")
    @ValueSource(strings = ["items.small.json", "items.medium.json", "items.large.json"])
    fun `the committed file is served byte for byte with its last modified`(name: String) = corpusTest {
        val file = Expected.raw(name)

        val response = client.get("/static/$name")

        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals(ContentType.Application.Json, response.contentType()?.withoutParameters())
        assertEquals(file.size.toString(), response.headers[HttpHeaders.ContentLength])
        assertNotNull(response.headers[HttpHeaders.LastModified])
        assertContentEquals(file, response.bodyAsBytes())
    }
}
