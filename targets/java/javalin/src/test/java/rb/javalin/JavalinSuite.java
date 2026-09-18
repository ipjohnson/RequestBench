package rb.javalin;

import io.javalin.Javalin;
import io.javalin.testtools.HttpClient;
import io.javalin.testtools.Request;
import io.javalin.testtools.Response;
import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeAll;
import rb.domain.Domain;

// rb:test *
/**
 * The target, started by JavalinTest.test() and driven through the client it hands a test.
 *
 * <p>javalin-testtools is Javalin's own and JavalinTest.test() is what its documentation tests
 * a route with. It is not in-process: every call starts the application on a random port and
 * stops it again, so each test pays a server start, and the Javalin it is given cannot be
 * started twice, so every test builds its own from Main.configure.
 *
 * <p>Its client is built on the JDK's HttpClient and reads every body as a String. That is
 * fine for JSON and HTML and fatal for gzip: compressed bytes decoded as UTF-8 cannot be
 * turned back into bytes, so a compressed response cannot be checked through it at all. For a
 * request that asks for gzip this suite writes the call itself, against the origin JavalinTest
 * started, with a byte-array handler. That is the one place the recommended client gives
 * nothing and the author writes the HTTP call by hand.
 *
 * <p>main() is where this target loads its fixture, and JavalinTest never calls it, so the
 * suite loads it.
 */
abstract class JavalinSuite {
  static final String TARGET = "java:javalin";

  @BeforeAll
  static void loadTheFixtureMainWouldHaveLoaded() throws Exception {
    Domain.load(Planned.ROOT.resolve("spec").resolve("fixture.json").toString());
  }

  /** A fresh application, because JavalinTest stops the one it is given. */
  static Javalin app() {
    return Javalin.create(Main::configure);
  }

  /** Send one of an endpoint's planned requests. */
  static Floor.Answer send(HttpClient client, Planned.Ask a) throws Exception {
    return send(client, a, a.headers());
  }

  static Floor.Answer send(HttpClient client, Planned.Ask a, Map<String, String> headers)
      throws Exception {
    if (headers.getOrDefault("accept-encoding", "").contains("gzip")) {
      return byHand(client, a, headers);
    }
    Response r = client.request(a.path(), b -> {
      headers.forEach(b::header);
      HttpRequest.BodyPublisher body = a.body() == null
          ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(a.body());
      switch (a.method()) {
        case "GET" -> b.get();
        case "POST" -> b.post(body);
        case "PUT" -> b.put(body);
        case "PATCH" -> b.patch(body);
        case "DELETE" -> b.delete(body);
        default -> throw new IllegalArgumentException(a.method());
      }
    });
    Map<String, String> out = new LinkedHashMap<>();
    for (String name : List.of("content-type", "content-encoding", "etag", "vary", "cache-control")) {
      List<String> values = r.headers().get(name);
      if (values != null && !values.isEmpty()) {
        out.put(name, String.join(", ", values));
      }
    }
    return new Floor.Answer(r.code(), out.getOrDefault("content-type", ""),
        out.getOrDefault("content-encoding", ""),
        r.body().string().getBytes(StandardCharsets.UTF_8), out);
  }

  /** The same request, sent with a client that keeps the body as bytes. */
  private static Floor.Answer byHand(HttpClient client, Planned.Ask a, Map<String, String> headers)
      throws Exception {
    HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(client.getOrigin() + a.path()));
    headers.forEach(b::header);
    b.method(a.method(), a.body() == null
        ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(a.body()));
    try (java.net.http.HttpClient jdk = java.net.http.HttpClient.newHttpClient()) {
      HttpResponse<byte[]> r = jdk.send(b.build(), HttpResponse.BodyHandlers.ofByteArray());
      Map<String, String> out = new LinkedHashMap<>();
      r.headers().map().forEach((k, v) -> out.put(k.toLowerCase(), String.join(", ", v)));
      return new Floor.Answer(r.statusCode(), out.getOrDefault("content-type", ""),
          out.getOrDefault("content-encoding", ""), r.body(), out);
    }
  }

  /** Ask for the validator first, then send the request that carries it. */
  static Floor.Answer sendAfterCapture(HttpClient client, Planned.Ask a) throws Exception {
    String[] c = Planned.captureFor(a);
    Response first = client.request(c[1], b -> b.get());
    List<String> values = first.headers().get(c[2]);
    String captured = values == null || values.isEmpty() ? "" : values.get(0);
    return send(client, a, Planned.resolved(a, captured));
  }
}
// rb:end
