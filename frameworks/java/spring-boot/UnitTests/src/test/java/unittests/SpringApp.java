package unittests;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import implementation.Application;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * The Implementation booted by Spring Boot's test support on a random port, so every request goes
 * through Tomcat as it does in the container. Spring's test context cache builds it once for every
 * test class.
 */
@SpringBootTest(classes = Application.class, webEnvironment = WebEnvironment.RANDOM_PORT)
abstract class SpringApp {

    private static final HttpClient CLIENT = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build();

    @LocalServerPort
    private int port;

    @DynamicPropertySource
    static void payloads(DynamicPropertyRegistry registry) {
        registry.add("RB_PAYLOADS", Expected::directory);
    }

    /** A request to this path, with each pair of strings after it as a header. */
    HttpRequest.Builder request(String path, String... headers) {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path));
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
