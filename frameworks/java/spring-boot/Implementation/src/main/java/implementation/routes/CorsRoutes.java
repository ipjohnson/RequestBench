package implementation.routes;

import implementation.Payload;
import implementation.Payloads;
import implementation.Serial;
import implementation.Settings;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * cors: Spring MVC's CORS support, mapped to /cors/** and nowhere else. It answers a preflight
 * before any handler runs, so the absence of x-rb-serial on a preflight shows the feature
 * answered alone. It adds Vary: Origin to every answer on the mapped paths.
 */
@RestController
public class CorsRoutes implements WebMvcConfigurer {

    private final Payloads p;

    CorsRoutes(Payloads p) {
        this.p = p;
    }

    @GetMapping("/cors/small")
    public Payload small(HttpServletResponse response) {
        Serial.write(response);
        return p.small();
    }

    // rb:wiring cors.*
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        Settings.Cors cors = p.settings().cors();
        registry.addMapping("/cors/**")
                .allowedOrigins(cors.origin())
                .allowedMethods(cors.method())
                .allowedHeaders(cors.header())
                .maxAge(cors.maxAgeSeconds());
    }
}
