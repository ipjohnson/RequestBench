package implementation;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.security.autoconfigure.web.servlet.SecurityFilterAutoConfiguration;
import org.springframework.cache.annotation.EnableCaching;

/**
 * RequestBench target: Spring Boot. One controller per corpus family under routes/, which
 * component scanning finds.
 */
// rb:wiring authorized.*
// Boot registers Spring Security's filter for every path and has no setting that narrows it, so
// AuthorizedSecurity registers it for /authorized alone in its place. Boot's generated user goes
// too, because nothing here signs in with a password.
@SpringBootApplication(exclude = {SecurityFilterAutoConfiguration.class, UserDetailsServiceAutoConfiguration.class})
// rb:end
// rb:wiring cache.*
// Spring's cache abstraction, over Boot's default provider, a ConcurrentMapCacheManager.
@EnableCaching
// rb:end
public class Application {

    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
