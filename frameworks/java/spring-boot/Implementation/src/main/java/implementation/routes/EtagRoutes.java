package implementation.routes;

import implementation.Payload;
import implementation.Payloads;
import implementation.Serial;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.filter.ShallowEtagHeaderFilter;

/**
 * etag: Spring's ShallowEtagHeaderFilter on these two routes. It buffers the body the handler
 * wrote, hashes it with MD5 into the ETag, and answers a matching If-None-Match with 304 in place
 * of the body. The handler runs and the body is built before anything is compared, so a 304 saves
 * the write and nothing else.
 */
@RestController
public class EtagRoutes {

    private final Payloads p;

    EtagRoutes(Payloads p) {
        this.p = p;
    }

    @GetMapping("/etag/small")
    public Payload small(HttpServletResponse response) {
        Serial.write(response);
        return p.small();
    }

    @GetMapping("/etag/large")
    public Payload large(HttpServletResponse response) {
        Serial.write(response);
        return p.large();
    }

    // rb:wiring etag.*
    /** Registered for /etag/* alone, because a filter bean with no registration runs on every path. */
    @Bean
    static FilterRegistrationBean<ShallowEtagHeaderFilter> etagFilter() {
        FilterRegistrationBean<ShallowEtagHeaderFilter> filter = new FilterRegistrationBean<>(new ShallowEtagHeaderFilter());
        filter.addUrlPatterns("/etag/*");
        return filter;
    }
}
