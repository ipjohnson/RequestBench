package unittests

import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import io.ktor.server.testing.ApplicationTestBuilder
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource

private suspend fun ApplicationTestBuilder.serial(path: String, vararg headers: Pair<String, String>): String =
    client.get(path) { headers.forEach { (name, value) -> header(name, value) } }.serial()

// Each test gets its own application, and so its own store.
class CacheTests {
    // rb:test cache.small,cache.medium,cache.large
    @ParameterizedTest
    @Tag("cache.small")
    @Tag("cache.medium")
    @Tag("cache.large")
    @ValueSource(strings = ["small", "medium", "large"])
    fun `a second request for a key is its stored answer`(size: String) = corpusTest {
        val first = client.get("/cache/$size/k1")
        val second = client.get("/cache/$size/k1")

        assertEquals(Expected.json("items.$size.json"), second.json())
        assertEquals(first.serial(), second.serial())
        assertNotEquals(first.serial(), client.get("/cache/$size/k2").serial())
        assertEquals(ContentType.Application.Json, second.contentType())
    }

    // rb:test cache.vary_one
    @Test
    @Tag("cache.vary_one")
    fun `one vary header keys the store`() = corpusTest {
        val alpha = serial("/cache/vary/one/k1", "x-rb-tenant" to "alpha")
        val beta = serial("/cache/vary/one/k1", "x-rb-tenant" to "beta")

        assertEquals(alpha, serial("/cache/vary/one/k1", "x-rb-tenant" to "alpha"))
        assertNotEquals(alpha, beta)
    }

    // rb:test cache.vary_many
    @Test
    @Tag("cache.vary_many")
    fun `each of three vary headers keys the store`() = corpusTest {
        val webEuAlpha = arrayOf("x-rb-channel" to "web", "x-rb-region" to "eu", "x-rb-tenant" to "alpha")

        val first = serial("/cache/vary/many/k1", *webEuAlpha)

        assertEquals(first, serial("/cache/vary/many/k1", *webEuAlpha))
        assertNotEquals(first, serial("/cache/vary/many/k1", "x-rb-channel" to "web", "x-rb-region" to "eu", "x-rb-tenant" to "beta"))
        assertNotEquals(first, serial("/cache/vary/many/k1", "x-rb-channel" to "web", "x-rb-region" to "us", "x-rb-tenant" to "alpha"))
    }

    @Test
    fun `the answer says what it varies on`() = corpusTest {
        assertEquals("x-rb-channel, x-rb-region, x-rb-tenant", client.get("/cache/vary/many/k1").headers[HttpHeaders.Vary])
    }

    @Test
    fun `a replay says what it varies on too`() = corpusTest {
        client.get("/cache/vary/one/k1")

        assertEquals("x-rb-tenant", client.get("/cache/vary/one/k1").headers[HttpHeaders.Vary])
    }

    @Test
    fun `a route outside the family is never stored`() = corpusTest {
        assertNotEquals(serial("/compressed/small"), serial("/compressed/small"))
    }
}
