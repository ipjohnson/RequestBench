package unittests

import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.http.withCharset
import kotlin.test.assertEquals
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test

class BaselineTests {
    // rb:test baseline.plaintext
    @Test
    @Tag("baseline.plaintext")
    fun `the string goes out as text`() = corpusTest {
        val response = client.get("/plaintext")

        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals("Hello, World!", response.bodyAsText())
        assertEquals(ContentType.Text.Plain.withCharset(Charsets.UTF_8), response.contentType())
    }
}
