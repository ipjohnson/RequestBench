package rb.spring.routes;

import jakarta.servlet.Filter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import rb.domain.Domain;
import rb.domain.Model.PayloadBody;

/**
 * middleware: per-layer dispatch cost at 0, 4 and 16 no-op layers.
 *
 * Spring's layer is a servlet Filter, and a FilterRegistrationBean takes the URL pattern it
 * applies to, which is the scoping the family needs. Each layer calls the chain and does
 * nothing else.
 */
@RestController
@Configuration
public class Middleware {

  /**
   * One registration is one layer. A servlet container runs a single Filter instance once
   * per request however many patterns point at it, so the count comes from distinct
   * registrations rather than from repeating a pattern.
   */
  private static FilterRegistrationBean<Filter> layer(String path, String name, int order) {
    // A fresh instance per layer. Tomcat registers a Filter object once and refuses the
    // second attempt, so twenty registrations sharing one instance failed the whole
    // context at startup rather than producing twenty layers.
    Filter noop = (request, response, chain) -> chain.doFilter(request, response);
    FilterRegistrationBean<Filter> bean = new FilterRegistrationBean<>(noop);
    bean.setName(name);
    bean.addUrlPatterns(path);
    bean.setOrder(order);
    return bean;
  }

  @Bean
  static org.springframework.beans.factory.config.BeanFactoryPostProcessor noopLayers() {
    return factory -> {
      // rb:snippet middleware.four
      for (int i = 0; i < 4; i++) {
        factory.registerSingleton("mwFour" + i, layer("/middleware/four", "mwFour" + i, i));
      }
      // rb:snippet middleware.sixteen
      for (int i = 0; i < 16; i++) {
        factory.registerSingleton("mwSixteen" + i,
                                 layer("/middleware/sixteen", "mwSixteen" + i, 100 + i));
      }
    };
  }

  @GetMapping("/middleware/none")
  PayloadBody none() {
    return Domain.payload("small");
  }

  @GetMapping("/middleware/four")
  PayloadBody four() {
    return Domain.payload("small");
  }

  @GetMapping("/middleware/sixteen")
  PayloadBody sixteen() {
    return Domain.payload("small");
  }
}
