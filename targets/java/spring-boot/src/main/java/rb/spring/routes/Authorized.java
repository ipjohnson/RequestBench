package rb.spring.routes;

import jakarta.servlet.Filter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import rb.domain.Domain;
import rb.domain.Json;
import rb.domain.Model.PayloadBody;

/**
 * authorized: the framework's authorization mechanism, crypto excluded.
 *
 * A servlet Filter bound to this path, not an if in the handler. An if would measure the
 * language; the point of the family is the framework's own plumbing. Spring Security is the
 * fuller answer and would bring a filter chain the other forty-four endpoints would also
 * pay for.
 */
@RestController
@Configuration
public class Authorized {

  @Bean
  // rb:wiring authorized.*
  FilterRegistrationBean<Filter> requireToken() {
    Filter filter = (request, response, chain) -> {
      HttpServletRequest req = (HttpServletRequest) request;
      if (!Domain.tokenOk(req.getHeader("authorization"))) {
        HttpServletResponse res = (HttpServletResponse) response;
        res.setStatus(403);
        res.setContentType("application/json");
        res.getOutputStream().write(Json.bytes(Domain.forbiddenBody()));
        return;
      }
      chain.doFilter(request, response);
    };
    FilterRegistrationBean<Filter> bean = new FilterRegistrationBean<>(filter);
    bean.addUrlPatterns("/authorized/small");
    return bean;
  }

  // rb:handler authorized.*
  @GetMapping("/authorized/small")
  PayloadBody small() {
    return Domain.payload("small");
  }
}
