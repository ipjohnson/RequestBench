package implementation.routes;

import implementation.Payloads;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * static: Spring MVC's resource handling over the payload directory, under /static/. It sends a
 * file with its length, a type read from its extension and its modification time.
 */
@Configuration
public class StaticRoutes implements WebMvcConfigurer {

    private final Payloads p;

    StaticRoutes(Payloads p) {
        this.p = p;
    }

    // rb:handler static.file
    // rb:wiring static.*
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/static/**").addResourceLocations(p.directory().toUri().toString());
    }
}
