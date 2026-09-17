package rb.vertx;

import io.vertx.core.Vertx;
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
    // rb:snippet errors.unmatched
    router.route().last().handler(ctx -> Reply.json(ctx, 404, Domain.notFoundBody()));

    vertx.createHttpServer()
         .requestHandler(router)
         .listen(Hosts.port())
         .toCompletionStage().toCompletableFuture().get();
    System.out.println("container/vertx listening on " + Hosts.port());
  }
}
