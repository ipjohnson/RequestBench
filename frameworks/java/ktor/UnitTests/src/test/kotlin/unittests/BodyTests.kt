package unittests

import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.testing.ApplicationTestBuilder
import kotlin.test.assertEquals
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource

private suspend fun ApplicationTestBuilder.post(path: String, body: ByteArray): HttpResponse =
    client.post(path) {
        contentType(ContentType.Application.Json)
        setBody(body)
    }

/** The reasons RequestValidation's refusal lists, in the order the rules found them. */
private fun reasons(vararg reasons: String) = JsonArray(reasons.map(::JsonPrimitive))

class BodyTests {
    // rb:test body.bind_small,body.bind_medium,body.validate_small,body.validate_medium
    @ParameterizedTest
    @Tag("body.bind_small")
    @Tag("body.bind_medium")
    @Tag("body.validate_small")
    @Tag("body.validate_medium")
    @CsvSource(
        "/body/bind/small, order.small.json",
        "/body/bind/medium, order.medium.json",
        "/body/validate/small, order.small.json",
        "/body/validate/medium, order.medium.json",
    )
    fun `an order is answered with its leaves its length and itself`(path: String, file: String) = corpusTest {
        val body = Expected.raw(file)

        val response = post(path, body)

        val order = Expected.json(file)
        val bound = buildJsonObject {
            put("fields", JsonPrimitive(2 + 2 * order.jsonObject["lines"]!!.jsonArray.size))
            put("bytes", JsonPrimitive(body.size))
            put("echo", order)
        }
        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals(bound, response.json())
    }

    // rb:test body.rejected_all
    @Test
    @Tag("body.rejected_all")
    fun `request validation refuses order invalid with every rule it breaks`() = corpusTest {
        val response = post("/body/validate/small", Expected.raw("order.invalid.json"))

        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertEquals(reasons("customerId must be at least 1", "status must not be empty", "lines must not be empty"), response.json())
    }

    // rb:test body.rejected_first
    @Test
    @Tag("body.rejected_first")
    fun `the first error route stops at the first rule`() = corpusTest {
        val response = post("/body/validate/first-error", Expected.raw("order.invalid.json"))

        assertEquals(HttpStatusCode.BadRequest, response.status)
        assertEquals(reasons("customerId must be at least 1"), response.json())
    }

    @Test
    fun `the first error route answers the reason the full check lists first`() = corpusTest {
        val body = """{"customerId":1,"status":"","lines":[{"productId":1,"qty":0}]}""".encodeToByteArray()

        val first = post("/body/validate/first-error", body).json().jsonArray
        val every = post("/body/validate/small", body).json().jsonArray

        assertEquals(every.take(1), first)
        assertEquals(reasons("status must not be empty", "lines[0].qty must be at least 1"), every)
    }

    @Test
    fun `the first error route binds a valid order`() = corpusTest {
        val response = post("/body/validate/first-error", Expected.raw("order.small.json"))

        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals(Expected.json("order.small.json"), response.json().jsonObject["echo"])
    }

    @Test
    fun `the bind routes check no rule`() = corpusTest {
        val response = post("/body/bind/small", Expected.raw("order.invalid.json"))

        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals(2, response.json().jsonObject["fields"]!!.jsonPrimitive.int)
    }
}
