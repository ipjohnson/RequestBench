package unittests;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import implementation.Payloads;
import implementation.Server;
import io.vertx.core.Vertx;
import io.vertx.junit5.VertxExtension;
import io.vertx.junit5.VertxTestContext;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.extension.ExtendWith;

/**
 * The Implementation's server verticle, deployed on a random port by vertx-junit5 for each test
 * class, so every request goes through Vert.x's HTTP server as it does in the container. The
 * container deploys one per core, and the suite deploys one.
 */
@ExtendWith(VertxExtension.class)
abstract class VertxApp {

    private static final HttpClient CLIENT = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();

    private static Server server;

    @BeforeAll
    static void deploy(Vertx vertx, VertxTestContext deployed) throws IOException {
        server = new Server(Payloads.load(Expected.directory()), 0);
        vertx.deployVerticle(server).onComplete(deployed.succeedingThenComplete());
    }

    /** A request to this path, with each pair of strings after it as a header. */
    HttpRequest.Builder request(String path, String... headers) {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + server.port() + path));
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
