package rb.vertx;

import io.vertx.core.DeploymentOptions;
import io.vertx.core.Future;
import io.vertx.core.VerticleBase;
import io.vertx.core.Vertx;
import io.vertx.core.http.HttpServerOptions;
import io.vertx.ext.web.Router;
import rb.domain.Domain;
import rb.hosts.Hosts;
import rb.vertx.routes.Authorized;
import rb.vertx.routes.Baseline;
import rb.vertx.routes.Body;
import rb.vertx.routes.Cache;
import rb.vertx.routes.Etag;
import rb.vertx.routes.Compressed;
import rb.vertx.routes.DomainRoutes;
import rb.vertx.routes.Headers;
import rb.vertx.routes.JsonRoutes;
import rb.vertx.routes.Middleware;
import rb.vertx.routes.Parameters;
import rb.vertx.routes.Query;
import rb.vertx.routes.Templates;

/**
 * RequestBench target: Vert.x Web. Framework wiring only; behaviour from rb-shared.
 *
 * One class per endpoint family, under routes/. Each registers its own routes and nothing
 * else is shared between them.
 */
public final class Main {
  private Main() {}

  public static void main(String[] args) throws Exception {
    Domain.load(Hosts.fixture());
    Vertx vertx = Vertx.vertx();
    // One server per CPU. Vert.x runs every connection a server accepts on the one event loop
    // the server was deployed on, and servers sharing a port take new connections in turn.
    vertx.deployVerticle(HttpServerVerticle::new,
                         new DeploymentOptions().setInstances(
                             Runtime.getRuntime().availableProcessors()))
         .toCompletionStage().toCompletableFuture().get();
    Hosts.listening();
    System.out.println("container/vertx listening on " + Hosts.port());
  }

  static final class HttpServerVerticle extends VerticleBase {
    @Override
    public Future<?> start() {
      return vertx.createHttpServer(options()).requestHandler(router(vertx)).listen(Hosts.port());
    }
  }

  /**
   * The HttpServer's own compression, on for every route. It gzips when the request asks for
   * it, with no size floor, at level 1, the fastest; Vert.x's default is 6. Its own method so
   * the suite's server compresses the way this one does.
   */
  // rb:wiring compressed.*
  static HttpServerOptions options() {
    return new HttpServerOptions().setCompressionSupported(true).setCompressionLevel(1);
  }

  /**
   * Every route, on a router nothing is listening with yet. Its own method so a test can put
   * it behind a server of its own: built inline in main(), the only way to reach it was to
   * start this target on its container port.
   */
  static Router router(Vertx vertx) {
    Router router = Router.router(vertx);

    Baseline.register(router);
    JsonRoutes.register(router);
    Parameters.register(router);
    Query.register(router);
    Headers.register(router);
    Middleware.register(router);
    Authorized.register(router);
    Compressed.register(router);
    Etag.register(router);
    Cache.register(router);
    Body.register(router);
    DomainRoutes.register(router);
    Templates.register(vertx, router);

    // errors: registered last. Vert.x matches routes in registration order, so a catch-all
    // mounted earlier would answer every route declared after it.
    //
    // rb:handler errors.unmatched
    router.route().last().handler(ctx -> Reply.json(ctx, 404, Domain.notFoundBody()));
    return router;
  }
}
