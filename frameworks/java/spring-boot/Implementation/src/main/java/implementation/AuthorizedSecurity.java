package implementation;

import org.springframework.boot.web.servlet.DelegatingFilterProxyRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.AbstractSecurityWebApplicationInitializer;
import org.springframework.security.web.util.matcher.RequestHeaderRequestMatcher;

/**
 * authorized: Spring Security, on /authorized alone. A request whose Authorization header is not
 * the bearer token settings.json names is denied. With no way to sign in configured, Spring
 * Security answers the denial through its Http403ForbiddenEntryPoint, which is a 403.
 */
@Configuration
public class AuthorizedSecurity {

    // rb:wiring authorized.*
    @Bean
    SecurityFilterChain authorized(HttpSecurity http, Payloads p) throws Exception {
        String bearer = "Bearer " + p.settings().token();
        return http
                .securityMatcher("/authorized/**")
                .authorizeHttpRequests(requests -> requests
                        .requestMatchers(new RequestHeaderRequestMatcher(HttpHeaders.AUTHORIZATION, bearer)).permitAll()
                        .anyRequest().denyAll())
                // Nothing is remembered between requests, so a denial does not open a session to
                // save the request in.
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .build();
    }

    /** Spring Security's filter, registered for /authorized/* where Boot would register it for every path. */
    @Bean
    DelegatingFilterProxyRegistrationBean securityFilterChainRegistration() {
        DelegatingFilterProxyRegistrationBean registration =
                new DelegatingFilterProxyRegistrationBean(AbstractSecurityWebApplicationInitializer.DEFAULT_FILTER_NAME);
        registration.addUrlPatterns("/authorized/*");
        return registration;
    }
    // rb:end
}
