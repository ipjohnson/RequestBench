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
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test

private val CORS = Expected.settings["cors"]!!.jsonObject
private fun cors(name: String) = CORS[name]!!.jsonPrimitive.content

private suspend fun ApplicationTestBuilder.preflight(path: String, origin: String): HttpResponse =
    client.options(path) {
        header(HttpHeaders.Origin, origin)
        header(HttpHeaders.AccessControlRequestMethod, cors("method"))
        header(HttpHeaders.AccessControlRequestHeaders, cors("header"))
    }

class CorsTests {
    // rb:test cors.preflight
    @Test
    @Tag("cors.preflight")
    fun `the plugin answers a preflight and no handler runs`() = corpusTest {
        val response = preflight("/cors/small", cors("origin"))

        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals(cors("origin"), response.headers[HttpHeaders.AccessControlAllowOrigin])
        assertEquals(cors("header"), response.headers[HttpHeaders.AccessControlAllowHeaders])
        assertEquals(cors("maxAgeSeconds"), response.headers[HttpHeaders.AccessControlMaxAge])
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
            header(HttpHeaders.Origin, cors("origin"))
            header(cors("header"), Expected.TENANT)
        }

        assertEquals(Expected.json("items.small.json"), response.json())
        assertEquals(cors("origin"), response.headers[HttpHeaders.AccessControlAllowOrigin])
        assertEquals("Origin", response.headers[HttpHeaders.Vary])
        assertNotNull(response.headers["x-rb-serial"])
    }

    // rb:test cors.scoped
    @Test
    @Tag("cors.scoped")
    fun `a route outside cors gets no policy`() = corpusTest {
        assertNull(client.get("/json/small") { header(HttpHeaders.Origin, cors("origin")) }.headers[HttpHeaders.AccessControlAllowOrigin])
    }
}
