package implementation.routes;

import java.time.Duration;
import java.util.Set;

import implementation.Payloads;
import implementation.Serial;
import implementation.Settings;
import io.helidon.webserver.cors.CorsFeature;
import io.helidon.webserver.http.HttpFeature;
import io.helidon.webserver.http.HttpRouting;

/**
 * cors: Helidon's CorsFeature, with its one policy on /cors/* and nowhere else. It answers a
 * preflight from a route of its own, so the absence of x-rb-serial on a preflight shows the
 * feature answered alone, and adds Vary: Origin to every answer it lets through.
 */
public final class CorsRoutes implements HttpFeature {

    private final Payloads p;

    public CorsRoutes(Payloads p) {
        this.p = p;
    }

    @Override
    public void setup(HttpRouting.Builder routing) {
        routing.get("/cors/small", (req, res) -> {
            Serial.write(res);
            res.send(p.small());
        });
    }

    // rb:wiring cors.*
    /**
     * The policy settings.json names, for /cors/* alone. CorsFeature adds a policy for every path
     * that allows any origin unless addDefaults is off, and each list below defaults to *, which an
     * add would keep. Its filter runs on every route and looks no further than the Origin header of
     * a request that has none.
     */
    public static CorsFeature feature(Settings.Cors cors) {
        return CorsFeature.create(builder -> builder
                .addDefaults(false)
                .pathsDiscoverServices(false)
                .addPath(path -> path
                        .pathPattern("/cors/*")
                        .allowOrigins(Set.of(cors.origin()))
                        .allowMethods(Set.of(cors.method()))
                        .allowHeaders(Set.of(cors.header()))
                        .maxAge(Duration.ofSeconds(cors.maxAgeSeconds()))));
    }
}
