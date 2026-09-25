package unittests

import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import kotlin.test.assertEquals
import kotlinx.serialization.json.Json
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource

class JsonTests {
    // rb:test json.small,json.medium,json.large
    @ParameterizedTest
    @Tag("json.small")
    @Tag("json.medium")
    @Tag("json.large")
    @ValueSource(strings = ["small", "medium", "large"])
    fun `the payload is encoded by kotlinx serialization`(size: String) = corpusTest {
        val response = client.get("/json/$size")

        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals(ContentType.Application.Json, response.contentType())
        assertEquals(Expected.json("items.$size.json"), response.json())
    }

    @Test
    fun `the json is compact and in the declared order`() = corpusTest {
        val compact = Json.encodeToString(Expected.json("items.small.json"))

        assertEquals(compact, client.get("/json/small").bodyAsText())
    }
}
