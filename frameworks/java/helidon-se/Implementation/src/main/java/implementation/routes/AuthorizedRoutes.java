package implementation.routes;

import implementation.Payloads;
import io.helidon.security.AuthorizationResponse;
import io.helidon.security.ProviderRequest;
import io.helidon.security.Security;
import io.helidon.security.providers.header.HeaderAtnProvider;
import io.helidon.security.spi.AuthorizationProvider;
import io.helidon.security.util.TokenHandler;
import io.helidon.webserver.http.HttpFeature;
import io.helidon.webserver.http.HttpRouting;
import io.helidon.webserver.security.SecurityFeature;

/**
 * authorized: Helidon Security in front of the route. SecurityFeature.secure() authenticates the
 * request and then authorizes it, and Helidon Security answers an authorization it denied with 403.
 */
public final class AuthorizedRoutes implements HttpFeature {

    private final Payloads p;

    public AuthorizedRoutes(Payloads p) {
        this.p = p;
    }

    @Override
    public void setup(HttpRouting.Builder routing) {
        routing.get("/authorized/small", SecurityFeature.secure(), (req, res) -> res.send(p.small()));
    }

    // rb:wiring authorized.*
    /**
     * Helidon Security for the server. HeaderAtnProvider takes the bearer token in Authorization as
     * the user's name, and PermitToken authorizes that user. SecurityFeature installs a filter on
     * every route, which builds a security context for each request whether the route asks for
     * security or not.
     */
    public static SecurityFeature feature(String token) {
        Security security = Security.builder()
                .addAuthenticationProvider(HeaderAtnProvider.builder()
                        .atnTokenHandler(TokenHandler.builder().tokenHeader("Authorization").tokenPrefix("Bearer ").build())
                        .build())
                .addAuthorizationProvider(new PermitToken(token))
                .build();
        return SecurityFeature.builder().security(security).build();
    }

    /** Permits the user when its name is settings.json's token, and denies any other. */
    private record PermitToken(String token) implements AuthorizationProvider {

        @Override
        public AuthorizationResponse authorize(ProviderRequest request) {
            boolean permitted = request.subject().map(user -> user.principal().id().equals(token)).orElse(false);
            return permitted ? AuthorizationResponse.permit() : AuthorizationResponse.deny();
        }
    }
    // rb:end
}
