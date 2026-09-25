package unittests

import io.ktor.client.request.get
import io.ktor.http.HttpStatusCode
import kotlin.test.assertEquals
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test

class ParametersTests {
    // rb:test parameters.static
    @Test
    @Tag("parameters.static")
    fun `the constant route wins over the capture that also matches it`() = corpusTest {
        assertEquals(Expected.json("items.small.json"), client.get("/parameters/static/segment/literal").json())
    }

    // rb:test parameters.one
    @Test
    @Tag("parameters.one")
    fun `the capture is echoed as an Int`() = corpusTest {
        val echo = buildJsonObject { put("one", JsonPrimitive(Expected.ONE)) }

        assertEquals(Expected.withEcho("items.small.json", echo), client.get("/parameters/${Expected.ONE}/segment/literal").json())
    }

    // rb:test parameters.two
    @Test
    @Tag("parameters.two")
    fun `both captures are echoed as Ints`() = corpusTest {
        val echo = buildJsonObject { put("one", JsonPrimitive(Expected.ONE)); put("two", JsonPrimitive(Expected.TWO)) }

        assertEquals(Expected.withEcho("items.small.json", echo), client.get("/parameters/${Expected.ONE}/with-second/${Expected.TWO}").json())
    }

    @Test
    fun `a capture that is not an Int is refused with 400`() = corpusTest {
        assertEquals(HttpStatusCode.BadRequest, client.get("/parameters/four/segment/literal").status)
    }
}
