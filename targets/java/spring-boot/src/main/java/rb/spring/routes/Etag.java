package rb.spring.routes;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.filter.ShallowEtagHeaderFilter;
import rb.domain.Domain;

/**
 * etag: Spring's own ShallowEtagHeaderFilter.
 *
 * The filter buffers the body the controller wrote, hashes it, writes the validator, and
 * answers If-None-Match with a 304 itself, so nothing here compares anything. Shallow is
 * the word Spring uses and the point of the row: the controller still runs and the body is
 * still built, so the 304 saves the write and nothing else.
 *
 * Registered against /etag/* rather than declared as a bean, because a bean is a filter on
 * every request and a digest over all forty-eight endpoints would contaminate the rows this
 * family is measured against. Scoping a filter by url pattern is Spring's own answer to
 * that, the same one the compressed family reaches for.
 */
@RestController
public class Etag {

  @Bean
  FilterRegistrationBean<ShallowEtagHeaderFilter> conditional() {
    FilterRegistrationBean<ShallowEtagHeaderFilter> bean =
        new FilterRegistrationBean<>(new ShallowEtagHeaderFilter());
    bean.addUrlPatterns("/etag/*");
    return bean;
  }

  private static ResponseEntity<Object> serve(String size) {
    return ResponseEntity.ok()
        .header(HttpHeaders.CACHE_CONTROL, Domain.CACHEABLE)
        .header("x-rb-serial", Domain.nextSerial())
        .body(Domain.payload(size));
  }

  // rb:snippet etag.small etag.large etag.match_large etag.stale_large
  @GetMapping("/etag/small")
  ResponseEntity<Object> small() {
    return serve("small");
  }

  @GetMapping("/etag/large")
  ResponseEntity<Object> large() {
    return serve("large");
  }
}
