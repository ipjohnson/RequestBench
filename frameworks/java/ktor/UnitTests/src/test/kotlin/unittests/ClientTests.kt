package unittests

import client.kiota.KtorClient
import client.kiota.models.Line
import client.kiota.models.Order
import com.microsoft.kiota.ApiException
import com.microsoft.kiota.authentication.AnonymousAuthenticationProvider
import com.microsoft.kiota.bundle.DefaultRequestAdapter
import implementation.corpus
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlinx.coroutines.runBlocking
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance

private fun order(customerId: Int, status: String, productId: Int, qty: Int) = Order().apply {
    this.customerId = customerId
    this.status = status
    lines = listOf(Line().apply { this.productId = productId; this.qty = qty })
}

/**
 * The Kiota client in Client/, generated from the document Ktor writes, calling the Implementation
 * under Netty on a free port. These hold the client to what Ktor answers, not Ktor to a corpus row,
 * so they carry no corpus tag.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ClientTests {
    private val server = embeddedServer(Netty, port = 0) { corpus(PAYLOADS) }
    private lateinit var client: KtorClient

    @BeforeAll
    fun start() {
        server.start()
        val port = runBlocking { server.engine.resolvedConnectors().first().port }
        // The client registers no serializers. The bundle's adapter registers Microsoft's.
        val adapter = DefaultRequestAdapter(AnonymousAuthenticationProvider())
        adapter.baseUrl = "http://127.0.0.1:$port"
        client = KtorClient(adapter)
    }

    @AfterAll
    fun stop() = server.stop()

    @Test
    fun `json small is the first row`() {
        // Kiota marks every model and field @Nullable.
        val answer = client.json().small().get()!!

        assertEquals("small", answer.size)
        assertEquals(1, answer.count)
        assertEquals(1, answer.items!!.first().id)
    }

    @Test
    fun `a row is typed by what the handler responds with`() {
        assertEquals(17, client.items().byId("17").get()!!.id)
    }

    @Test
    fun `a validated order is bound`() {
        val answer = client.body().validate().small().post(order(1, "open", 1, 1))!!

        assertEquals(4, answer.fields)
        assertEquals(1, answer.echo!!.customerId)
    }

    @Test
    fun `a rejected order is an api exception with the status`() {
        val refused = assertFailsWith<ApiException> { client.body().validate().small().post(order(0, "", 0, 0)) }

        assertEquals(400, refused.responseStatusCode)
    }
}
