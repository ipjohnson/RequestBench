package unittests

import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.head
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsBytes
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import kotlin.test.assertEquals
import kotlin.test.assertContentEquals
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test

private fun created(id: Int) = JsonObject(mapOf("id" to JsonPrimitive(id)) + Expected.json("items.new.json").jsonObject)

class ItemsTests {
    // rb:test items.read
    @Test
    @Tag("items.read")
    fun `a row is read by the id in the path`() = corpusTest {
        val response = client.get("/items/17")

        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals(Expected.row(17), response.json())
    }

    // rb:test items.head
    @Test
    @Tag("items.head")
    fun `head is answered by the get handler with no body`() = corpusTest {
        val response = client.head("/items/17")

        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals(ContentType.Application.Json, response.contentType())
        assertContentEquals(ByteArray(0), response.bodyAsBytes())
    }

    // rb:test items.create
    @Test
    @Tag("items.create")
    fun `a created item is the row after the last`() = corpusTest {
        val response = client.post("/items") { contentType(ContentType.Application.Json); setBody(Expected.raw("items.new.json")) }

        assertEquals(HttpStatusCode.Created, response.status)
        assertEquals("/items/1426", response.headers[HttpHeaders.Location])
        assertEquals(created(1426), response.json())
    }

    // rb:test items.replace
    @Test
    @Tag("items.replace")
    fun `a replaced item takes the id in the path`() = corpusTest {
        val response = client.put("/items/17") { contentType(ContentType.Application.Json); setBody(Expected.raw("items.new.json")) }

        assertEquals(created(17), response.json())
    }

    // rb:test items.update
    @Test
    @Tag("items.update")
    fun `a patch is merged onto the row`() = corpusTest {
        val response = client.patch("/items/17") { contentType(ContentType.Application.Json); setBody(Expected.raw("items.patch.json")) }

        assertEquals(JsonObject(Expected.row(17) + Expected.json("items.patch.json").jsonObject), response.json())
    }

    // rb:test items.delete
    @Test
    @Tag("items.delete")
    fun `a delete is answered 204 with no body`() = corpusTest {
        val response = client.delete("/items/17")

        assertEquals(HttpStatusCode.NoContent, response.status)
        assertContentEquals(ByteArray(0), response.bodyAsBytes())
    }

    @Test
    fun `a patch that names one field changes that field alone`() = corpusTest {
        val response = client.patch("/items/17") { contentType(ContentType.Application.Json); setBody("""{"inStock":false}""") }

        assertEquals(JsonObject(Expected.row(17) + ("inStock" to JsonPrimitive(false))), response.json())
    }

    @Test
    fun `a patch or a delete of a missing row is 404`() = corpusTest {
        val patch = client.patch("/items/999999") { contentType(ContentType.Application.Json); setBody(Expected.raw("items.patch.json")) }

        assertEquals(HttpStatusCode.NotFound, patch.status)
        assertEquals(HttpStatusCode.NotFound, client.delete("/items/999999").status)
    }
}
