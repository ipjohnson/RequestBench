package unittests;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Path;

import implementation.Application;
import implementation.Payloads;
import io.javalin.Javalin;
import io.javalin.testtools.HttpClient;

/**
 * The Implementation as javalin-testtools runs it: JavalinTest.test starts the application on a
 * random port, hands the test a client for it, and stops it afterwards, so every request goes
 * through Jetty as it does in the container. A Javalin starts once, so each test gets a new one.
 */
abstract class JavalinApp {

    /** The payloads, loaded once for every test, as main loads them before Javalin starts. */
    static final Payloads PAYLOADS = payloads();

    /** For what the testtools client cannot send or read: HEAD, OPTIONS, a body as bytes, and a gzip answer. */
    private static final java.net.http.HttpClient BYTES =
            java.net.http.HttpClient.newBuilder().version(java.net.http.HttpClient.Version.HTTP_1_1).build();

    static Javalin app() {
        return Application.create(PAYLOADS);
    }

    /** A request to the application under test, with each pair of strings after the path as a header. */
    static HttpRequest.Builder request(HttpClient client, String path, String... headers) {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(client.getOrigin() + path));
        for (int i = 0; i < headers.length; i += 2) {
            request.header(headers[i], headers[i + 1]);
        }
        return request;
    }

    /** The answer with its body as the bytes that arrived. */
    static HttpResponse<byte[]> send(HttpRequest.Builder request) throws IOException, InterruptedException {
        return BYTES.send(request.build(), HttpResponse.BodyHandlers.ofByteArray());
    }

    private static Payloads payloads() {
        try {
            return Payloads.load(Path.of(Expected.directory()));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
