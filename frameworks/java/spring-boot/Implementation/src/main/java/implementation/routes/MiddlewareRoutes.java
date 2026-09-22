package implementation.routes;

import java.io.IOException;

import implementation.Payload;
import implementation.Payloads;
import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import org.springframework.boot.web.servlet.ServletContextInitializer;
import org.springframework.context.annotation.Bean;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * middleware: no-op servlet filters in front of the handler, four or sixteen of them, each
 * registered for its one path. Every other request pays Tomcat's check of each filter's path,
 * which is a string comparison.
 */
@RestController
public class MiddlewareRoutes {

    private final Payloads p;

    MiddlewareRoutes(Payloads p) {
        this.p = p;
    }

    @GetMapping("/middleware/none")
    public Payload none() {
        return p.small();
    }

    // The filters below name these two paths too, so the handlers are marked.
    // rb:handler middleware.four
    @GetMapping("/middleware/four")
    public Payload four() {
        return p.small();
    }

    // rb:handler middleware.sixteen
    @GetMapping("/middleware/sixteen")
    public Payload sixteen() {
        return p.small();
    }

    // rb:wiring middleware.*
    /** One layer: it calls the next and does nothing else. */
    static final class Noop implements Filter {

        @Override
        public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
                throws IOException, ServletException {
            chain.doFilter(request, response);
        }
    }

    /** Each registration is one layer, mapped to its route's path alone. */
    @Bean
    static ServletContextInitializer layers() {
        return context -> {
            for (int i = 0; i < 4; i++) {
                context.addFilter("four-" + i, new Noop()).addMappingForUrlPatterns(null, true, "/middleware/four");
            }
            for (int i = 0; i < 16; i++) {
                context.addFilter("sixteen-" + i, new Noop()).addMappingForUrlPatterns(null, true, "/middleware/sixteen");
            }
        };
    }
    // rb:end
}
