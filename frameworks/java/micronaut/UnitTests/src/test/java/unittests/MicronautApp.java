package unittests;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;

import io.micronaut.runtime.server.EmbeddedServer;
import io.micronaut.test.extensions.junit5.annotation.MicronautTest;
import io.micronaut.test.support.TestPropertyProvider;
import jakarta.inject.Inject;
import org.junit.jupiter.api.TestInstance;

/**
 * The Implementation booted by Micronaut's test support on a random port, so every request goes
 * through Netty as it does in the container. @MicronautTest starts an application context and its
 * server for each test class. A test that supplies properties has to share one instance across its
 * methods, which is the PER_CLASS lifecycle.
 */
@MicronautTest
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
abstract class MicronautApp implements TestPropertyProvider {

    private static final HttpClient CLIENT = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();

    @Inject
    EmbeddedServer server;

    @Override
    public Map<String, String> getProperties() {
        return Map.of("rb.payloads", Expected.directory(), "micronaut.server.port", "-1");
    }

    /** A request to this path, with each pair of strings after it as a header. */
    HttpRequest.Builder request(String path, String... headers) {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + server.getPort() + path));
        for (int i = 0; i < headers.length; i += 2) {
            request.header(headers[i], headers[i + 1]);
        }
        return request;
    }

    HttpResponse<byte[]> send(HttpRequest.Builder request) throws IOException, InterruptedException {
        return CLIENT.send(request.build(), HttpResponse.BodyHandlers.ofByteArray());
    }

    HttpResponse<byte[]> get(String path, String... headers) throws IOException, InterruptedException {
        return send(request(path, headers).GET());
    }

    /** A body sent with its content type. */
    HttpResponse<byte[]> send(String method, String path, String type, byte[] body) throws IOException, InterruptedException {
        return send(request(path, "content-type", type).method(method, HttpRequest.BodyPublishers.ofByteArray(body)));
    }
}
