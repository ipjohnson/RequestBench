package unittests

import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.HttpRequestBuilder
import io.ktor.http.HttpStatusCode
import kotlin.test.assertEquals
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import org.junit.jupiter.api.Tag
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource
import org.junit.jupiter.api.Test

/** The three headers the binding rows bind, and as many more as asked that nothing reads. The many rows send twenty-five of those. */
private fun HttpRequestBuilder.headers(unread: Int, account: String = Expected.ACCOUNT.toString()) {
    header("x-rb-tenant", Expected.TENANT)
    header("x-rb-request-id", Expected.REQUEST_ID)
    header("x-rb-account", account)
    repeat(unread) { header("x-rb-unread-$it", "unread") }
}

class HeadersTests {
    // rb:test headers.few,headers.many
    @ParameterizedTest
    @Tag("headers.few")
    @Tag("headers.many")
    @ValueSource(ints = [0, 25])
    fun `headers nothing reads leave the answer alone`(unread: Int) = corpusTest {
        assertEquals(Expected.json("items.small.json"), client.get("/headers") { headers(unread) }.json())
    }

    // rb:test headers.bind_few,headers.bind_many
    @ParameterizedTest
    @Tag("headers.bind_few")
    @Tag("headers.bind_many")
    @ValueSource(ints = [0, 25])
    fun `three headers are bound and echoed the account as an Int`(unread: Int) = corpusTest {
        val echo = buildJsonObject {
            put("tenant", JsonPrimitive(Expected.TENANT))
            put("requestId", JsonPrimitive(Expected.REQUEST_ID))
            put("account", JsonPrimitive(Expected.ACCOUNT))
        }

        assertEquals(Expected.withEcho("items.small.json", echo), client.get("/headers/bind") { headers(unread) }.json())
    }

    @Test
    fun `an account that is no Int is refused with 400`() = corpusTest {
        assertEquals(HttpStatusCode.BadRequest, client.get("/headers/bind") { headers(0, account = "many") }.status)
    }
}
