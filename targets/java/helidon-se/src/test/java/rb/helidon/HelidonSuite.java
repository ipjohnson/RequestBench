package rb.helidon;

import io.helidon.http.Header;
import io.helidon.http.HeaderNames;
import io.helidon.http.Method;
import io.helidon.webclient.http1.Http1Client;
import io.helidon.webclient.http1.Http1ClientRequest;
import io.helidon.webclient.http1.Http1ClientResponse;
import io.helidon.webserver.http.HttpRouting;
import io.helidon.webserver.testing.junit5.ServerTest;
import io.helidon.webserver.testing.junit5.SetUpRoute;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import rb.domain.Domain;

// rb:test *
/**
 * The target, started by @ServerTest and driven through the Http1Client it injects.
 *
 * <p>@ServerTest is where Helidon's SE testing documentation starts, and it is not in-process:
 * the documentation says so itself, "an integration test annotation that starts the server
 * (opens ports)". @RoutingTest is the alternative that does not, and the documentation calls
 * that one the unit test; this suite follows the example it leads with.
 *
 * <p>@SetUpRoute hands the routing builder to the same Main.routes the target serves from,
 * which is Helidon's documented shape and needs nothing from the target. The fixture is loaded
 * there too rather than in a @BeforeAll: the extension starts the server, and so builds the
 * routes, before any @BeforeAll runs, and main() is where the target loads it.
 *
 * <p>The client costs two things a reader would not guess. uri() takes a path and nothing
 * after it, so a query string has to be taken apart and handed to queryParam one parameter at a
 * time, and entity() throws on a 204 or a 304 rather than answering empty. What it does not do
 * is decode: a gzip body arrives as the bytes the route wrote.
 */
@ServerTest
abstract class HelidonSuite {
  static final String TARGET = "java:helidon-se";

  final Http1Client client;

  HelidonSuite(Http1Client client) {
    this.client = client;
  }

  @SetUpRoute
  static void routing(HttpRouting.Builder builder) throws Exception {
    Domain.load(Planned.ROOT.resolve("spec").resolve("fixture.json").toString());
    Main.routes(builder);
  }

  /** Send one of an endpoint's planned requests. */
  Floor.Answer send(Planned.Ask a) {
    return send(a, a.headers());
  }

  Floor.Answer send(Planned.Ask a, Map<String, String> headers) {
    // uri() takes a path and nothing after it: a query string written into it is part of the
    // path and the route misses. Each parameter goes in on its own, decoded, because
    // queryParam encodes what it is given.
    URI uri = URI.create(a.path());
    Http1ClientRequest req = client.method(Method.create(a.method())).uri(uri.getRawPath())
        .headers(h -> headers.forEach((k, v) -> h.set(HeaderNames.create(k), v)));
    if (uri.getRawQuery() != null) {
      for (String pair : uri.getRawQuery().split("&")) {
        String[] kv = pair.split("=", 2);
        req.queryParam(decode(kv[0]), kv.length > 1 ? decode(kv[1]) : "");
      }
    }
    try (Http1ClientResponse r = a.body() == null ? req.request() : req.submit(a.body())) {
      Map<String, String> out = new LinkedHashMap<>();
      for (Header h : r.headers()) {
        out.put(h.name().toLowerCase(), h.values());
      }
      // entity() on a 204 or a 304 throws rather than answering empty.
      byte[] body = r.entity().hasEntity() ? r.entity().as(byte[].class) : new byte[0];
      return new Floor.Answer(r.status().code(), out.getOrDefault("content-type", ""),
          out.getOrDefault("content-encoding", ""), body, out);
    }
  }

  private static String decode(String s) {
    return URLDecoder.decode(s, StandardCharsets.UTF_8);
  }

  /** Ask for the validator first, then send the request that carries it. */
  Floor.Answer sendAfterCapture(Planned.Ask a) {
    String[] c = Planned.captureFor(a);
    String captured;
    try (Http1ClientResponse first = client.method(Method.create(c[0])).uri(c[1]).request()) {
      captured = first.headers().first(HeaderNames.create(c[2])).orElse("");
    }
    return send(a, Planned.resolved(a, captured));
  }
}
// rb:end
