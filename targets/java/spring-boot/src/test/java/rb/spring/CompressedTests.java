package rb.spring;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpMethod;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.test.web.servlet.client.EntityExchangeResult;
import org.springframework.test.web.servlet.client.RestTestClient;
import rb.domain.Domain;

/**
 * compressed: outbound gzip, the cost of the wiring declining and the cost of it working.
 *
 * <p>The family a test client can quietly fail to reach. Where a target compresses inside the
 * application an in-process client still runs the codec; where the compression belongs to the
 * server underneath, no in-process client reaches it and the only honest test is one over a real port.
 *
 * <p>The second trap is the client. Some of the clients here decode gzip before the body is
 * read, so a test reading the decoded body would pass every assertion below against an identity
 * response. The suite's own send says whether this one does.
 *
 * <p>So this family does not go through MockMvc. The compression is Tomcat's, on the connector,
 * and MockMvc calls the DispatcherServlet with no connector in front of it. This class starts the
 * application on a random port, which is what Spring Boot's reference does when a test needs the
 * running server, and sends through a RestTestClient bound to it. The client runs on Spring's
 * JdkClientHttpRequestFactory, which asks for gzip and decodes it unless told not to, so its
 * compression is turned off and the body is the bytes Tomcat wrote.
 */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
class CompressedTests {

  @LocalServerPort int port;

  // rb:test compressed.*
  @BeforeAll
  static void loadTheFixtureMainWouldHaveLoaded() throws Exception {
    Domain.load(Planned.ROOT.resolve("spec").resolve("fixture.json").toString());
  }

  /** Send one of an endpoint's planned requests to the running server. */
  Floor.Answer send(Planned.Ask a) {
    JdkClientHttpRequestFactory jdk = new JdkClientHttpRequestFactory();
    jdk.enableCompression(false);
    RestTestClient client = RestTestClient.bindToServer(jdk).baseUrl("http://localhost:" + port).build();
    EntityExchangeResult<byte[]> r = client.method(HttpMethod.valueOf(a.method())).uri(a.path())
        .headers(h -> a.headers().forEach(h::set))
        .exchange()
        .returnResult(byte[].class);
    Map<String, String> out = new LinkedHashMap<>();
    r.getResponseHeaders().forEach((name, values) -> out.put(name.toLowerCase(), String.join(", ", values)));
    byte[] body = r.getResponseBody() == null ? new byte[0] : r.getResponseBody();
    return new Floor.Answer(r.getStatus().value(), out.getOrDefault("content-type", ""),
        out.getOrDefault("content-encoding", ""), body, out);
  }
  // rb:end

  // rb:test compressed.identity_small
  @Test
  void a_client_that_will_not_take_gzip_is_answered_in_full() {
    Planned.Ask a = Planned.ask("compressed.identity_small");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
    assertEquals("", answer.encoding());
  }

  // rb:test compressed.identity_large
  @Test
  void the_large_payload_is_uncompressed_too_when_identity_was_asked_for() {
    Planned.Ask a = Planned.ask("compressed.identity_large");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
    assertEquals("", answer.encoding());
  }

  // rb:test compressed.gzip_small
  @Test
  void a_payload_under_the_shared_floor_is_gzipped_anyway() {
    Planned.Ask a = Planned.ask("compressed.gzip_small");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
    // spec/expected.json pins no encoding here, because the frameworks disagree about a body
    // this small. Tomcat holds back a body under server.compression.min-response-size only when
    // it knows the length before the headers go out, and Spring writes this JSON without one.
    assertEquals("gzip", answer.encoding());
  }

  // rb:test compressed.gzip_large
  @Test
  void a_payload_over_the_floor_is_gzipped_and_says_what_it_varies_on() {
    Planned.Ask a = Planned.ask("compressed.gzip_large");

    Floor.Answer answer = send(a);

    Floor.check(a, answer);
    assertEquals("gzip", answer.encoding());
    // A target that gzips without Vary: Accept-Encoding passes the floor and is wrong in
    // front of any shared cache.
    assertTrue(answer.headers().getOrDefault("vary", "").toLowerCase().contains("accept-encoding"));
  }
}
