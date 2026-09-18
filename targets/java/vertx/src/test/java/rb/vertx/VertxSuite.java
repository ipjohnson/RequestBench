package rb.vertx;

import io.vertx.core.Future;
import io.vertx.core.Vertx;
import io.vertx.core.buffer.Buffer;
import io.vertx.core.http.HttpMethod;
import io.vertx.core.http.HttpServer;
import io.vertx.ext.web.client.HttpRequest;
import io.vertx.ext.web.client.HttpResponse;
import io.vertx.ext.web.client.WebClient;
import io.vertx.junit5.VertxExtension;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.extension.ExtendWith;
import rb.domain.Domain;

// rb:test *
/**
 * The target, served by a Vert.x HttpServer the suite starts, under vertx-junit5's
 * VertxExtension, and driven with WebClient, which is what vertx-junit5's documentation tests
 * an HTTP server with.
 *
 * <p>This is the one Java target whose code had to change before a test could reach it. Its
 * router was built inline in main(), so the only way in was to start the target on its
 * container port; Main.router(vertx) now builds it, and main() calls the same method. The
 * starter's shape is to deploy a verticle, and this target has none, so the suite starts a
 * server around the router instead, on a random port, which is not in-process either.
 *
 * <p>The suite first drove it with the core HttpClient and lost a body now and then:
 * middleware.sixteen once read a 200 with a JSON content type and nothing in it, in CI and never
 * locally. The core client hands a response's body to whatever is listening when it arrives,
 * and a small response can arrive and end before a chain of futures has got round to asking
 * for it. WebClient reads the whole body before it returns the response, so nothing is ever
 * listening late. Like the core client it neither decompresses nor sends Accept-Encoding
 * unless told to, so the body is the bytes the route wrote and the request carries only what
 * the plan sends. main() is where this target loads its fixture, so the suite loads it.
 */
@ExtendWith(VertxExtension.class)
abstract class VertxSuite {
  static final String TARGET = "java:vertx";

  static HttpServer server;
  static WebClient client;

  @BeforeAll
  static void serveTheRouter(Vertx vertx) throws Exception {
    Domain.load(Planned.ROOT.resolve("spec").resolve("fixture.json").toString());
    server = vertx.createHttpServer().requestHandler(Main.router(vertx)).listen(0)
        .toCompletionStage().toCompletableFuture().get();
    client = WebClient.create(vertx);
  }

  @AfterAll
  static void stop() throws Exception {
    client.close();
    server.close().toCompletionStage().toCompletableFuture().get();
  }

  /** Send one of an endpoint's planned requests. */
  static Floor.Answer send(Planned.Ask a) throws Exception {
    return send(a, a.headers());
  }

  static Floor.Answer send(Planned.Ask a, Map<String, String> headers) throws Exception {
    HttpRequest<Buffer> req =
        client.request(HttpMethod.valueOf(a.method()), server.actualPort(), "localhost", a.path());
    headers.forEach(req::putHeader);
    Future<HttpResponse<Buffer>> sent =
        a.body() == null ? req.send() : req.sendBuffer(Buffer.buffer(a.body()));
    HttpResponse<Buffer> r = sent.toCompletionStage().toCompletableFuture().get();
    Map<String, String> out = new LinkedHashMap<>();
    r.headers().names().forEach(n -> out.put(n.toLowerCase(), String.join(", ", r.headers().getAll(n))));
    // A 204 or a 304 has no body, and WebClient answers that with null rather than empty.
    byte[] body = r.body() == null ? new byte[0] : r.body().getBytes();
    return new Floor.Answer(r.statusCode(), out.getOrDefault("content-type", ""),
        out.getOrDefault("content-encoding", ""), body, out);
  }

  /** Ask for the validator first, then send the request that carries it. */
  static Floor.Answer sendAfterCapture(Planned.Ask a) throws Exception {
    String[] c = Planned.captureFor(a);
    HttpResponse<Buffer> first = client
        .request(HttpMethod.valueOf(c[0]), server.actualPort(), "localhost", c[1])
        .send().toCompletionStage().toCompletableFuture().get();
    String captured = first.getHeader(c[2]);
    return send(a, Planned.resolved(a, captured == null ? "" : captured));
  }
}
// rb:end
