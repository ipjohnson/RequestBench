package unittests

import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import kotlin.test.assertEquals
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test

class AuthorizedTests {
    // rb:test authorized.allowed
    @Test
    @Tag("authorized.allowed")
    fun `the accepted token reaches the handler`() = corpusTest {
        val response = client.get("/authorized/small") { header(HttpHeaders.Authorization, "Bearer 5a7cc77ed0dcb825806b6f872026c317") }

        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals(Expected.json("items.small.json"), response.json())
    }

    // rb:test authorized.denied
    @Test
    @Tag("authorized.denied")
    fun `a token one character off is refused with 403`() = corpusTest {
        val response = client.get("/authorized/small") { header(HttpHeaders.Authorization, "Bearer 5a7cc77ed0dcb825806b6f872026c310") }

        assertEquals(HttpStatusCode.Forbidden, response.status)
        assertEquals("You are not allowed to visit this page", response.bodyAsText())
    }

    @Test
    fun `no token is Ktors 401 challenge`() = corpusTest {
        val response = client.get("/authorized/small")

        assertEquals(HttpStatusCode.Unauthorized, response.status)
        assertEquals("Bearer", response.headers[HttpHeaders.WWWAuthenticate])
    }

    @Test
    fun `a route outside the family runs no check`() = corpusTest {
        assertEquals(HttpStatusCode.OK, client.get("/json/small").status)
    }
}
