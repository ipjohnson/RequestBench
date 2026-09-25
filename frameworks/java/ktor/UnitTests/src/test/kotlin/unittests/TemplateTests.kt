package unittests

import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import kotlin.test.assertEquals
import org.junit.jupiter.api.Tag
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource

class TemplateTests {
    // rb:test template.small,template.medium
    @ParameterizedTest
    @Tag("template.small")
    @Tag("template.medium")
    @ValueSource(strings = ["small", "medium"])
    fun `the payload is rendered by the thymeleaf template`(size: String) = corpusTest {
        val response = client.get("/template/$size")

        assertEquals(HttpStatusCode.OK, response.status)
        assertEquals(ContentType.Text.Html, response.contentType()?.withoutParameters())
        assertEquals(Expected.page("items.$size.json"), Expected.normal(response.bodyAsText()))
    }
}
