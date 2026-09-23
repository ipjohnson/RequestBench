package implementation;

import io.quarkus.security.identity.SecurityIdentity;
import io.quarkus.vertx.http.runtime.security.HttpSecurityPolicy;
import io.smallrye.mutiny.Uni;
import io.vertx.core.http.HttpHeaders;
import io.vertx.ext.web.RoutingContext;
import jakarta.enterprise.context.ApplicationScoped;

/**
 * authorized: the policy the permission on /authorized/* names in application.properties. It
 * permits a request whose Authorization header is the bearer token settings.json names and denies
 * any other. With no authentication mechanism installed, Quarkus answers the denial with the 403
 * its fallback mechanism sends as the challenge. A request with no token is refused the same way.
 */
// rb:wiring authorized.*
@ApplicationScoped
public class BearerTokenPolicy implements HttpSecurityPolicy {

    private final String bearer;

    BearerTokenPolicy(Payloads p) {
        this.bearer = "Bearer " + p.settings().token();
    }

    /** The identity is never asked for, so a permitted request is not authenticated at all. */
    @Override
    public Uni<CheckResult> checkPermission(RoutingContext request, Uni<SecurityIdentity> identity,
                                            AuthorizationRequestContext context) {
        return bearer.equals(request.request().getHeader(HttpHeaders.AUTHORIZATION)) ? CheckResult.permit() : CheckResult.deny();
    }

    @Override
    public String name() {
        return "bearer-token";
    }
}
