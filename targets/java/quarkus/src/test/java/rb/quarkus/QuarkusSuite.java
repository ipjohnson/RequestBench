package rb.quarkus;

import static io.restassured.RestAssured.given;

import io.restassured.RestAssured;
import io.restassured.config.DecoderConfig;
import io.restassured.config.EncoderConfig;
import io.restassured.config.RestAssuredConfig;
import io.restassured.response.Response;
import io.restassured.specification.RequestSpecification;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeAll;

// rb:test *
/**
 * The target, started by @QuarkusTest and driven with REST Assured, which is what
 * code.quarkus.io writes for a new project.
 *
 * <p>Not in-process. @QuarkusTest builds and starts the application once for the whole run,
 * HTTP server included, on its test port, and REST Assured sends it real requests. It is also
 * the one Java target whose startup work a test host does for it: this target loads its fixture
 * on the StartupEvent, and @QuarkusTest fires that, where the other five load it in a main()
 * their test hosts never call. The generator writes a @QuarkusIntegrationTest as well, which
 * reruns the same tests against the packaged jar in a process of its own; that is integration
 * rather than a unit test, and it is not here.
 *
 * <p>REST Assured sends Accept-Encoding: gzip,deflate on every request and decodes what comes
 * back, so a request the plan sends with no Accept-Encoding would ask for gzip, and a gzip body
 * would arrive already decoded. noContentDecoders() turns both off, which is REST Assured's own
 * switch for it. It also appends a charset to a JSON content type unless told not to.
 */
abstract class QuarkusSuite {
  static final String TARGET = "java:quarkus";

  @BeforeAll
  static void sendThePlansRequestAndKeepTheBytes() {
    RestAssured.config = RestAssuredConfig.config()
        .decoderConfig(DecoderConfig.decoderConfig().noContentDecoders())
        .encoderConfig(EncoderConfig.encoderConfig()
            .appendDefaultContentCharsetToContentTypeIfUndefined(false));
  }

  /** Send one of an endpoint's planned requests. */
  static Floor.Answer send(Planned.Ask a) {
    return send(a, a.headers());
  }

  static Floor.Answer send(Planned.Ask a, Map<String, String> headers) {
    RequestSpecification req = given().urlEncodingEnabled(false).headers(headers);
    if (a.body() != null) {
      req.body(a.body());
    }
    Response r = req.when().request(a.method(), a.path()).then().extract().response();
    Map<String, String> out = new LinkedHashMap<>();
    r.getHeaders().forEach(h -> out.merge(h.getName().toLowerCase(), h.getValue(), (x, y) -> x + ", " + y));
    return new Floor.Answer(r.getStatusCode(), out.getOrDefault("content-type", ""),
        out.getOrDefault("content-encoding", ""), r.asByteArray(), out);
  }

  /** Ask for the validator first, then send the request that carries it. */
  static Floor.Answer sendAfterCapture(Planned.Ask a) {
    String[] c = Planned.captureFor(a);
    String captured = given().when().request(c[0], c[1]).then().extract().header(c[2]);
    return send(a, Planned.resolved(a, captured == null ? "" : captured));
  }
}
// rb:end
