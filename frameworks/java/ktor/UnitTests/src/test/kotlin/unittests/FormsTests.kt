package unittests

import io.ktor.client.request.forms.formData
import io.ktor.client.request.forms.submitForm
import io.ktor.client.request.forms.submitFormWithBinaryData
import io.ktor.http.Headers
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.parameters
import kotlin.test.assertEquals
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test

class FormsTests {
    // rb:test forms.urlencoded
    @Test
    @Tag("forms.urlencoded")
    fun `query manys eight values from a form the numbers as Ints`() = corpusTest {
        val response = client.submitForm("/forms/urlencoded", parameters { Expected.SEARCH.forEach { (name, value) -> append(name, value) } })

        assertEquals(Expected.withEcho("items.small.json", Expected.SEARCH_ECHO), response.json())
    }

    // rb:test forms.multipart
    @Test
    @Tag("forms.multipart")
    fun `the file is read to its end and the fields are echoed`() = corpusTest {
        val file = Expected.raw("forms.file.txt")

        val response = client.submitFormWithBinaryData("/forms/multipart", formData {
            append("tenant", Expected.TENANT)
            append("requestId", Expected.REQUEST_ID)
            append("file", file, Headers.build {
                append(HttpHeaders.ContentType, "text/plain")
                append(HttpHeaders.ContentDisposition, "filename=\"forms.file.txt\"")
            })
        })

        val uploaded = buildJsonObject {
            put("file", buildJsonObject { put("name", JsonPrimitive("forms.file.txt")); put("bytes", JsonPrimitive(file.size)) })
            put("echo", buildJsonObject { put("tenant", JsonPrimitive(Expected.TENANT)); put("requestId", JsonPrimitive(Expected.REQUEST_ID)) })
        }
        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals(uploaded, response.json())
    }
}
