package implementation;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;

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
import io.helidon.webserver.WebServer;
import io.helidon.webserver.WebServerConfig;

/**
 * RequestBench target: Helidon SE. One HttpFeature per corpus family under routes/, each
 * registering its own routes, and three server features, for CORS, security and static files.
 */
public final class Main {

    private Main() {}

    public static void main(String[] args) throws IOException {
        Payloads p = Payloads.load(Path.of(System.getenv("RB_PAYLOADS")));
        WebServerConfig.Builder server = WebServer.builder()
                .host("0.0.0.0")
                .port(Integer.parseInt(System.getenv().getOrDefault("PORT", "8080")));
        setup(server, p);
        server.build().start();
    }

    /** Everything but the address, which the suite's server chooses for itself. */
    public static void setup(WebServerConfig.Builder server, Payloads p) {
        // features() replaces the list. The suite's server builder arrives holding the features
        // Helidon's service registry found, a CorsFeature that allows every origin among them.
        server.featuresDiscoverServices(false)
                .features(List.of(CorsRoutes.feature(p.settings().cors()),
                                  AuthorizedRoutes.feature(p.settings().token()),
                                  StaticRoutes.feature(p.directory())))
                .contentEncoding(CompressedRoutes.encoding())
                // Helidon writes the last chunk of a chunked answer in a write of its own. With
                // Nagle's algorithm on, Helidon's default, the socket holds that write until the
                // client acknowledges the data before it, which a delayed acknowledgement puts off by
                // about 40 ms. Helidon's performance guide names this option for such workloads.
                .connectionOptions(options -> options.tcpNoDelay(true))
                .routing(routing -> routing
                        .addFeature(new ContractRoutes())
                        .addFeature(new BaselineRoutes())
                        .addFeature(new JsonRoutes(p))
                        .addFeature(new MiddlewareRoutes(p))
                        .addFeature(new ParametersRoutes(p))
                        .addFeature(new QueryRoutes(p))
                        .addFeature(new HeadersRoutes(p))
                        .addFeature(new BodyRoutes())
                        .addFeature(new AuthorizedRoutes(p))
                        .addFeature(new CacheRoutes(p))
                        .addFeature(new CompressedRoutes(p))
                        .addFeature(new EtagRoutes(p))
                        .addFeature(new TemplateRoutes(p))
                        .addFeature(new ItemsRoutes(p))
                        .addFeature(new CorsRoutes(p))
                        .addFeature(new FormsRoutes(p))
                        .addFeature(new StreamRoutes(p))
                        .addFeature(new SseRoutes(p)));
    }
}
