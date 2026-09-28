package implementation.routes;

import java.util.List;

import implementation.Payload;
import implementation.Payloads;
import io.micronaut.core.async.publisher.Publishers;
import io.micronaut.http.HttpRequest;
import io.micronaut.http.annotation.Controller;
import io.micronaut.http.annotation.Get;
import io.micronaut.security.annotation.Secured;
import io.micronaut.security.authentication.Authentication;
import io.micronaut.security.token.validator.TokenValidator;
import jakarta.inject.Singleton;
import org.reactivestreams.Publisher;

/**
 * authorized: micronaut-security, whose filter application.properties scopes to /authorized.
 * BearerTokenReader reads the Authorization header's bearer token, OneToken validates it, and
 * @Secured asks for the role the validation grants.
 */
@Controller
@Secured(AuthorizedRoutes.ROLE)
public class AuthorizedRoutes {

    static final String ROLE = "token";

    private final Payloads p;

    AuthorizedRoutes(Payloads p) {
        this.p = p;
    }

    @Get("/authorized/small")
    public Payload small() {
        return p.small();
    }

    // rb:wiring authorized.*
    /**
     * Every bearer token authenticates, and the one token named here alone carries the role. A token
     * one character off is an authenticated request that @Secured refuses, which
     * micronaut-security answers with 403. A request with no token is anonymous, which it answers
     * with 401.
     */
    @Singleton
    static final class OneToken implements TokenValidator<HttpRequest<?>> {

        private static final String TOKEN = "5a7cc77ed0dcb825806b6f872026c317";

        @Override
        public Publisher<Authentication> validateToken(String token, HttpRequest<?> request) {
            List<String> roles = TOKEN.equals(token) ? List.of(ROLE) : List.of();
            return Publishers.just(Authentication.build("bearer", roles));
        }
    }
}
