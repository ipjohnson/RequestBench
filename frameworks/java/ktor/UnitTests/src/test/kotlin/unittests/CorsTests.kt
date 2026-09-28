package unittests

import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.options
import io.ktor.client.statement.HttpResponse
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.ApplicationTestBuilder
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test

private const val ORIGIN = "https://shop.example.com"

private suspend fun ApplicationTestBuilder.preflight(path: String, origin: String): HttpResponse =
    client.options(path) {
        header(HttpHeaders.Origin, origin)
        header(HttpHeaders.AccessControlRequestMethod, "GET")
        header(HttpHeaders.AccessControlRequestHeaders, "x-rb-tenant")
    }

class CorsTests {
    // rb:test cors.preflight
    @Test
    @Tag("cors.preflight")
    fun `the plugin answers a preflight and no handler runs`() = corpusTest {
        val response = preflight("/cors/small", ORIGIN)

        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals(ORIGIN, response.headers[HttpHeaders.AccessControlAllowOrigin])
        assertEquals("x-rb-tenant", response.headers[HttpHeaders.AccessControlAllowHeaders])
        assertEquals("600", response.headers[HttpHeaders.AccessControlMaxAge])
        assertNull(response.headers["x-rb-serial"])
    }

    // rb:test cors.disallowed
    @Test
    @Tag("cors.disallowed")
    fun `a preflight from another origin is refused with 403`() = corpusTest {
        val response = preflight("/cors/small", "https://elsewhere.example.net")

        assertEquals(HttpStatusCode.Forbidden, response.status)
        assertNull(response.headers[HttpHeaders.AccessControlAllowOrigin])
    }

    // rb:test cors.request,cors.vary
    @Test
    @Tag("cors.request")
    @Tag("cors.vary")
    fun `the request reaches the handler and varies on origin`() = corpusTest {
        val response = client.get("/cors/small") {
            header(HttpHeaders.Origin, ORIGIN)
            header("x-rb-tenant", Expected.TENANT)
        }

        assertEquals(Expected.json("items.small.json"), response.json())
        assertEquals(ORIGIN, response.headers[HttpHeaders.AccessControlAllowOrigin])
        assertEquals("Origin", response.headers[HttpHeaders.Vary])
        assertNotNull(response.headers["x-rb-serial"])
    }

    // rb:test cors.scoped
    @Test
    @Tag("cors.scoped")
    fun `a route outside cors gets no policy`() = corpusTest {
        assertNull(client.get("/json/small") { header(HttpHeaders.Origin, ORIGIN) }.headers[HttpHeaders.AccessControlAllowOrigin])
    }
}
