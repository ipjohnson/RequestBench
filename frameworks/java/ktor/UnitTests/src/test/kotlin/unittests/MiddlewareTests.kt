package unittests

import io.ktor.client.request.get
import kotlin.test.assertEquals
import org.junit.jupiter.api.Tag
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource

class MiddlewareTests {
    // rb:test middleware.none,middleware.four,middleware.sixteen
    @ParameterizedTest
    @Tag("middleware.none")
    @Tag("middleware.four")
    @Tag("middleware.sixteen")
    @ValueSource(strings = ["none", "four", "sixteen"])
    fun `the layers in front of the handler leave the answer alone`(layers: String) = corpusTest {
        assertEquals(Expected.json("items.small.json"), client.get("/middleware/$layers").json())
    }
}
