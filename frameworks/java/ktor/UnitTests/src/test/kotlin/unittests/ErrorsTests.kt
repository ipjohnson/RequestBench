package unittests

import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import kotlin.test.assertEquals
import kotlin.test.assertNull
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test

// errors: every refusal is Ktor's own. Nothing here reshapes any of them.
class ErrorsTests {
    // rb:test errors.unmatched
    @Test
    @Tag("errors.unmatched")
    fun `a path no route matches is the routers 404 with no body`() = corpusTest {
        val response = client.get("/errors/unmatched")

        assertEquals(HttpStatusCode.NotFound, response.status)
        assertEquals("", response.bodyAsText())
    }

    // rb:test errors.not_found
    @Test
    @Tag("errors.not_found")
    fun `an id with no row is the handlers 404`() = corpusTest {
        val response = client.get("/items/999999")

        assertEquals(HttpStatusCode.NotFound, response.status)
        assertEquals("No item with id 999999", response.bodyAsText())
    }

    // rb:test errors.wrong_method
    @Test
    @Tag("errors.wrong_method")
    fun `a method a path with a capture has no route for is 404`() = corpusTest {
        assertEquals(HttpStatusCode.NotFound, client.post("/items/17").status)
    }

    @Test
    fun `a method a constant path has no route for is 405 with no allow header`() = corpusTest {
        val response = client.post("/json/small")

        assertEquals(HttpStatusCode.MethodNotAllowed, response.status)
        assertNull(response.headers[HttpHeaders.Allow])
    }

    // rb:test errors.malformed
    @Test
    @Tag("errors.malformed")
    fun `a body that is not json is ktors 400`() = corpusTest {
        val response = client.post("/body/validate/small") { contentType(ContentType.Application.Json); setBody("""{"customerId": 1, "lines": [""") }

        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertEquals("Failed to convert request body to class implementation.routes.Order", response.bodyAsText())
    }
}
