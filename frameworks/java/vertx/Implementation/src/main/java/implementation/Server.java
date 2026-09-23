package implementation;

import implementation.routes.AuthorizedRoutes;
import implementation.routes.BaselineRoutes;
import implementation.routes.BodyRoutes;
import implementation.routes.CacheRoutes;
import implementation.routes.CompressedRoutes;
import implementation.routes.ContractRoutes;
import implementation.routes.CorsRoutes;
import implementation.routes.EtagRoutes;
import implementation.routes.FormsRoutes;
import implementation.routes.HeadersRoutes;
import implementation.routes.ItemsRoutes;
import implementation.routes.JsonRoutes;
import implementation.routes.MiddlewareRoutes;
import implementation.routes.ParametersRoutes;
import implementation.routes.QueryRoutes;
import implementation.routes.SseRoutes;
import implementation.routes.StaticRoutes;
import implementation.routes.StreamRoutes;
import implementation.routes.TemplateRoutes;
import io.vertx.core.Future;
import io.vertx.core.VerticleBase;
import io.vertx.core.http.HttpServer;
import io.vertx.core.http.HttpServerOptions;
import io.vertx.ext.web.Router;

/**
 * One HTTP server and its router. Vert.x runs every connection a server accepts on the event loop
 * the verticle was deployed on, and servers listening on one port take new connections in turn,
 * so Application deploys one per core. Each builds its own router, because Vert.x Web's handlers
 * keep their state for one event loop.
 */
public final class Server extends VerticleBase {

    private final Payloads payloads;

    private final int port;

    private HttpServer server;

    public Server(Payloads payloads, int port) {
        this.payloads = payloads;
        this.port = port;
    }

    @Override
    public Future<?> start() {
        server = vertx.createHttpServer(options());
        return server.requestHandler(router()).listen(port);
    }

    /** The port the server listens on, which a test asks for after deploying it on port 0. */
    public int port() {
        return server.actualPort();
    }

    // rb:wiring compressed.*
    /**
     * The server's own compression, for every answer whose request asks for gzip, at level 1, the
     * fastest. Vert.x's default is 6. It sits in every connection's pipeline and has no size floor.
     */
    static HttpServerOptions options() {
        return new HttpServerOptions().setCompressionSupported(true).setCompressionLevel(1);
    }
    // rb:end

    /**
     * Every route. Vert.x Web tries routes in the order they are added, and the first that matches
     * the path and the method answers.
     */
    private Router router() {
        Router router = Router.router(vertx);
        ContractRoutes.register(router);
        BaselineRoutes.register(router);
        JsonRoutes.register(router, payloads);
        MiddlewareRoutes.register(router, payloads);
        ParametersRoutes.register(router, payloads);
        QueryRoutes.register(router, payloads);
        HeadersRoutes.register(router, payloads);
        BodyRoutes.register(router);
        AuthorizedRoutes.register(router, vertx, payloads);
        CacheRoutes.register(router, vertx, payloads);
        CompressedRoutes.register(router, payloads);
        EtagRoutes.register(router, payloads);
        TemplateRoutes.register(router, vertx, payloads);
        ItemsRoutes.register(router, payloads);
        CorsRoutes.register(router, payloads);
        FormsRoutes.register(router, payloads);
        StreamRoutes.register(router, payloads);
        SseRoutes.register(router, payloads);
        StaticRoutes.register(router, payloads);
        return router;
    }
}
