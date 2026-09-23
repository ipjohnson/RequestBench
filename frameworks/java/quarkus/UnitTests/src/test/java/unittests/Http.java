package unittests;

import io.restassured.RestAssured;
import io.restassured.config.DecoderConfig;
import io.restassured.config.EncoderConfig;
import io.restassured.config.RestAssuredConfig;
import io.restassured.response.Response;
import io.restassured.specification.RequestSpecification;

/**
 * Requests to the application @QuarkusTest started, sent with REST Assured, which Quarkus points
 * at the application's port. Every request goes through Vert.x as it does in the container.
 */
final class Http {

    /**
     * REST Assured otherwise asks for gzip and decodes it before a test reads the body, and adds a
     * charset to a content type it sends. It is set on each request, because Quarkus puts back
     * REST Assured's global configuration after each test class.
     */
    private static final RestAssuredConfig CONFIG = RestAssuredConfig.config()
            .decoderConfig(DecoderConfig.decoderConfig().noContentDecoders())
            .encoderConfig(EncoderConfig.encoderConfig().appendDefaultContentCharsetToContentTypeIfUndefined(false));

    private Http() {}

    /** A request with each pair of strings after it as a header. */
    static RequestSpecification request(String... headers) {
        RequestSpecification request = RestAssured.given().config(CONFIG);
        for (int i = 0; i < headers.length; i += 2) {
            request.header(headers[i], headers[i + 1]);
        }
        return request;
    }

    static Response get(String path, String... headers) {
        return request(headers).get(path);
    }

    /** A body sent with its content type. */
    static Response send(String method, String path, String type, byte[] body) {
        return request().contentType(type).body(body).request(method, path);
    }
}
