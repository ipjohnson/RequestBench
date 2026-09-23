package implementation;

import java.io.IOException;
import java.nio.file.Path;

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
import io.javalin.Javalin;
import io.javalin.compression.CompressionStrategy;
import io.javalin.compression.Gzip;

/**
 * RequestBench target: Javalin. One class per corpus family under routes/, each adding its routes
 * to the config, because Javalin 7 takes every route before the server starts.
 */
public final class Application {

    private Application() {}

    public static void main(String[] args) throws IOException {
        Payloads payloads = Payloads.load(Path.of(System.getenv("RB_PAYLOADS")));
        create(payloads).start(Integer.parseInt(System.getenv().getOrDefault("PORT", "8080")));
    }

    /**
     * The application, configured and not started, so the suite can start one for each test. Javalin
     * matches a request against its routes in the order they were added, so baseline and json go
     * first.
     */
    public static Javalin create(Payloads p) {
        return Javalin.create(config -> {
            config.startup.showJavalinBanner = false;
            // rb:wiring compressed.*
            // Javalin's compression covers the whole application and has no setting that narrows
            // it. It is on by default at gzip's level 6, and this sets the fastest level.
            config.http.compressionStrategy = new CompressionStrategy(null, new Gzip(1));
            new BaselineRoutes().register(config);
            new JsonRoutes(p).register(config);
            new MiddlewareRoutes(p).register(config);
            new ParametersRoutes(p).register(config);
            new QueryRoutes(p).register(config);
            new HeadersRoutes(p).register(config);
            new BodyRoutes().register(config);
            new ItemsRoutes(p).register(config);
            new AuthorizedRoutes(p).register(config);
            new CacheRoutes(p).register(config);
            new CompressedRoutes(p).register(config);
            new EtagRoutes(p).register(config);
            new CorsRoutes(p).register(config);
            new FormsRoutes(p).register(config);
            new TemplateRoutes(p).register(config);
            new StreamRoutes(p).register(config);
            new SseRoutes(p).register(config);
            new StaticRoutes(p).register(config);
            new ContractRoutes().register(config);
        });
    }
}
