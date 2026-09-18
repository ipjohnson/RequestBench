package rb.micronaut;

import io.micronaut.http.HttpMethod;
import io.micronaut.http.HttpRequest;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.MutableHttpRequest;
import io.micronaut.http.client.HttpClient;
import io.micronaut.http.client.annotation.Client;
import io.micronaut.http.client.exceptions.HttpClientResponseException;
import jakarta.inject.Inject;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeAll;
import rb.domain.Domain;

// rb:test *
/**
 * The target, started by @MicronautTest and driven through the declarative HTTP client it
 * injects.
 *
 * <p>Not in-process. @MicronautTest starts the application context and its embedded Netty
 * server on a random port, and a @Client("/") HttpClient sends it real requests. Micronaut
 * Launch writes this client into a new application at test scope for that reason.
 *
 * <p>The client decodes a gzip body and then removes Content-Encoding, so a compressed answer
 * and an identity one look the same to a test. application-test.properties turns that off,
 * with micronaut.http.client.decompression-enabled, which is Micronaut's own switch for it.
 *
 * <p>The blocking client throws on any answer of 400 or above rather than returning it, so an
 * error endpoint's answer has to be recovered out of the exception. And @MicronautTest builds
 * the context without calling main(), which is where this target loads its fixture, so the
 * suite loads it; controllers are created on first use, so a @BeforeAll is early enough.
 */
abstract class MicronautSuite {
  static final String TARGET = "java:micronaut";

  @Inject
  @Client("/")
  HttpClient client;

  @BeforeAll
  static void loadTheFixtureMainWouldHaveLoaded() throws Exception {
    Domain.load(Planned.ROOT.resolve("spec").resolve("fixture.json").toString());
  }

  /** Send one of an endpoint's planned requests. */
  Floor.Answer send(Planned.Ask a) {
    return send(a, a.headers());
  }

  Floor.Answer send(Planned.Ask a, Map<String, String> headers) {
    MutableHttpRequest<Object> req = HttpRequest.create(HttpMethod.parse(a.method()), a.path());
    headers.forEach(req::header);
    if (a.body() != null) {
      req.body(a.body());
    }
    HttpResponse<byte[]> r;
    try {
      r = client.toBlocking().exchange(req, byte[].class);
    } catch (HttpClientResponseException e) {
      @SuppressWarnings("unchecked")
      HttpResponse<byte[]> refused = (HttpResponse<byte[]>) e.getResponse();
      r = refused;
    }
    Map<String, String> out = new LinkedHashMap<>();
    r.getHeaders().forEach((name, values) -> out.put(name.toLowerCase(), String.join(", ", values)));
    return new Floor.Answer(r.code(), out.getOrDefault("content-type", ""),
        out.getOrDefault("content-encoding", ""), r.getBody(byte[].class).orElse(new byte[0]), out);
  }

  /** Ask for the validator first, then send the request that carries it. */
  Floor.Answer sendAfterCapture(Planned.Ask a) {
    String[] c = Planned.captureFor(a);
    HttpResponse<byte[]> first =
        client.toBlocking().exchange(HttpRequest.create(HttpMethod.parse(c[0]), c[1]), byte[].class);
    return send(a, Planned.resolved(a, first.getHeaders().get(c[2]) == null ? "" : first.getHeaders().get(c[2])));
  }
}
// rb:end
