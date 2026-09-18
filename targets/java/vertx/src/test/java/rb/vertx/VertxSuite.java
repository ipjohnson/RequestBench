package rb.vertx;

import io.vertx.core.Vertx;
import io.vertx.core.buffer.Buffer;
import io.vertx.core.http.HttpClient;
import io.vertx.core.http.HttpClientRequest;
import io.vertx.core.http.HttpClientResponse;
import io.vertx.core.http.HttpMethod;
import io.vertx.core.http.HttpServer;
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
 * VertxExtension, and driven with Vert.x's own HttpClient.
 *
 * <p>This is the one Java target whose code had to change before a test could reach it. Its
 * router was built inline in main(), so the only way in was to start the target on its
 * container port; Main.router(vertx) now builds it, and main() calls the same method. The
 * starter's shape is to deploy a verticle, and this target has none, so the suite starts a
 * server around the router instead, on a random port, which is not in-process either.
 *
 * <p>The core HttpClient neither decompresses nor sends Accept-Encoding unless it is told to,
 * so the body arrives as the bytes the route wrote and the request carries only what the plan
 * sends. What it does ask is that the body be requested inside the callback that receives the
 * response: a test that blocks for the response and asks afterwards loses what Vert.x
 * delivered in between, and reads an empty or truncated body the target never sent. main() is
 * where this target loads its fixture, so the suite loads it.
 */
@ExtendWith(VertxExtension.class)
abstract class VertxSuite {
  static final String TARGET = "java:vertx";

  static HttpServer server;
  static HttpClient client;

  @BeforeAll
  static void serveTheRouter(Vertx vertx) throws Exception {
    Domain.load(Planned.ROOT.resolve("spec").resolve("fixture.json").toString());
    server = vertx.createHttpServer().requestHandler(Main.router(vertx)).listen(0)
        .toCompletionStage().toCompletableFuture().get();
    client = vertx.createHttpClient();
  }

  @AfterAll
  static void stop() throws Exception {
    client.close().toCompletionStage().toCompletableFuture().get();
    server.close().toCompletionStage().toCompletableFuture().get();
  }

  /** Send one of an endpoint's planned requests. */
  static Floor.Answer send(Planned.Ask a) throws Exception {
    return send(a, a.headers());
  }

  static Floor.Answer send(Planned.Ask a, Map<String, String> headers) throws Exception {
    // The body is asked for inside the callback that receives the response, on the event loop.
    // Blocking for the response first and asking afterwards loses whatever Vert.x delivered in
    // between, and a test sees an empty or truncated body that the target never sent.
    return client
        .request(HttpMethod.valueOf(a.method()), server.actualPort(), "localhost", a.path())
        .compose(req -> {
          headers.forEach(req::putHeader);
          return a.body() == null ? req.send() : req.send(a.body());
        })
        .compose(r -> r.body().map(body -> answer(r, body)))
        .toCompletionStage().toCompletableFuture().get();
  }

  private static Floor.Answer answer(HttpClientResponse r, Buffer body) {
    Map<String, String> out = new LinkedHashMap<>();
    r.headers().names().forEach(n -> out.put(n.toLowerCase(), String.join(", ", r.headers().getAll(n))));
    return new Floor.Answer(r.statusCode(), out.getOrDefault("content-type", ""),
        out.getOrDefault("content-encoding", ""), body.getBytes(), out);
  }

  /** Ask for the validator first, then send the request that carries it. */
  static Floor.Answer sendAfterCapture(Planned.Ask a) throws Exception {
    String[] c = Planned.captureFor(a);
    HttpClientResponse first = client
        .request(HttpMethod.valueOf(c[0]), server.actualPort(), "localhost", c[1])
        .compose(HttpClientRequest::send)
        .toCompletionStage().toCompletableFuture().get();
    String captured = first.getHeader(c[2]);
    return send(a, Planned.resolved(a, captured == null ? "" : captured));
  }
}
// rb:end
