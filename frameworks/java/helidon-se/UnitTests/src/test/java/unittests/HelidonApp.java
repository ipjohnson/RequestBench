package unittests;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import implementation.Main;
import implementation.Payloads;
import io.helidon.webserver.WebServerConfig;
import io.helidon.webserver.testing.junit5.ServerTest;
import io.helidon.webserver.testing.junit5.SetUpServer;
import org.junit.jupiter.api.BeforeEach;

/**
 * The Implementation started by Helidon's @ServerTest on a random port, so every request goes
 * through the WebServer and its listener as it does in the container. The extension starts one
 * server for each test class.
 */
@ServerTest
abstract class HelidonApp {

    private static final HttpClient CLIENT = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();

    private URI server;

    @SetUpServer
    static void server(WebServerConfig.Builder server) throws IOException {
        Main.setup(server, Payloads.load(Expected.directory()));
    }

    @BeforeEach
    void connect(URI server) {
        this.server = server;
    }

    /** A request to this path, with each pair of strings after it as a header. */
    HttpRequest.Builder request(String path, String... headers) {
        HttpRequest.Builder request = HttpRequest.newBuilder(server.resolve(path));
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
