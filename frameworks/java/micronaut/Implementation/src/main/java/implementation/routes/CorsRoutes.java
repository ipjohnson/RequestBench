package implementation.routes;

import java.util.List;
import java.util.Map;

import implementation.Payload;
import implementation.Payloads;
import implementation.Serial;
import implementation.Settings;
import io.micronaut.context.event.BeanCreatedEvent;
import io.micronaut.context.event.BeanCreatedEventListener;
import io.micronaut.http.HttpMethod;
import io.micronaut.http.HttpResponse;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import io.micronaut.http.server.HttpServerConfiguration;
import io.micronaut.http.server.cors.CorsOriginConfiguration;
import jakarta.inject.Singleton;

/**
 * cors: Micronaut's CorsFilter, with the policy settings.json names. It answers a preflight before
 * any route runs, so the absence of x-rb-serial on a preflight shows the feature answered alone. It
 * adds Vary: Origin to every answer it decorates.
 */
@Controller
public class CorsRoutes {

    private final Payloads p;

    CorsRoutes(Payloads p) {
        this.p = p;
    }

    @Get("/cors/small")
    public HttpResponse<Payload> small() {
        return Serial.ok(p.small());
    }

    // rb:wiring cors.*
    /**
     * The policy, set on the server's CORS configuration when Micronaut creates it. A configuration
     * covers every route. The per-route @CrossOrigin takes its policy as annotation constants,
     * which would copy settings.json into the source.
     */
    @Singleton
    static final class Policy implements BeanCreatedEventListener<HttpServerConfiguration.CorsConfiguration> {

        private final Settings.Cors cors;

        Policy(Payloads p) {
            this.cors = p.settings().cors();
        }

        @Override
        public HttpServerConfiguration.CorsConfiguration onCreated(BeanCreatedEvent<HttpServerConfiguration.CorsConfiguration> event) {
            CorsOriginConfiguration policy = new CorsOriginConfiguration();
            policy.setAllowedOrigins(List.of(cors.origin()));
            policy.setAllowedMethods(List.of(HttpMethod.parse(cors.method())));
            policy.setAllowedHeaders(List.of(cors.header()));
            policy.setMaxAge((long) cors.maxAgeSeconds());
            HttpServerConfiguration.CorsConfiguration configuration = event.getBean();
            configuration.setEnabled(true);
            configuration.setConfigurations(Map.of("settings", policy));
            return configuration;
        }
    }
}
